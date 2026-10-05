import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { prisma } from "../../../lib/prisma.js";
import { resolveMonth, currentMonth, formatMonth, recentMonths } from "../../../lib/month.js";
import { getPagination } from "../../../lib/pagination.js";
import { toReportWithContext, toActivityLogView } from "../../../lib/serialize.js";
import { tutorPortalUrl, tutorReminder, whatsappLink } from "../../../lib/whatsapp.js";
import { COMPLETED_REPORT_STATUSES } from "../../../config/constants.js";

const dashboardQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});

const historyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

/** `/api/admin/dashboard` — the admin landing screen in one request. */
export const dashboardRouter: Router = Router();

dashboardRouter.get(
  "/",
  validate({ query: dashboardQuerySchema }),
  asyncHandler(async (req, res) => {
    const month = resolveMonth(req.query.month as string | undefined, { allowFuture: true }) ?? currentMonth();

    const [
      totalTutors,
      activeTutors,
      totalStudents,
      activeStudents,
      totalCourses,
      expected,
      submittedCount,
      reviewedCount,
      draftCount,
      revisionCount,
      outstandingRows,
      recentReports,
      trend,
    ] = await Promise.all([
      prisma.tutor.count(),
      prisma.tutor.count({ where: { isActive: true } }),
      prisma.student.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.course.count({ where: { isActive: true } }),
      prisma.assignment.count({ where: { isActive: true } }),
      prisma.report.count({ where: { month, status: "SUBMITTED" } }),
      prisma.report.count({ where: { month, status: "REVIEWED" } }),
      prisma.report.count({ where: { month, status: "DRAFT" } }),
      prisma.report.count({ where: { month, status: "NEEDS_REVISION" } }),
      prisma.tutor.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, phone: true, accessToken: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.report.findMany({
        where: { month, status: { in: ["SUBMITTED", "REVIEWED"] } },
        include: {
          assignment: {
            select: {
              level: true,
              tutor: { select: { id: true, fullName: true, email: true, phone: true } },
              student: {
                select: {
                  id: true,
                  fullName: true,
                  ageGroup: true,
                  parentName: true,
                  parentPhone: true,
                  parentEmail: true,
                },
              },
              course: { select: { id: true, name: true, category: true } },
            },
          },
          reviewedByAdmin: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 8,
      }),
      (async () => {
        const months = recentMonths(6, month);
        const grouped = await prisma.report.groupBy({
          by: ["month", "status"],
          where: { month: { in: months } },
          _count: { _all: true },
        });
        return months.map((entry) => {
          const rows = grouped.filter((row) => row.month === entry);
          const completed = rows
            .filter((row) => (COMPLETED_REPORT_STATUSES as readonly string[]).includes(row.status))
            .reduce((total, row) => total + row._count._all, 0);
          return { month: entry, label: formatMonth(entry), submitted: completed };
        });
      })(),
    ]);

    // Per-tutor progress for the "not completed" list.
    const tutorProgress = await Promise.all(
      outstandingRows.map(async (tutor) => {
        const assignments = await prisma.assignment.findMany({
          where: { tutorId: tutor.id, isActive: true },
          select: {
            id: true,
            reports: { where: { month }, select: { status: true } },
          },
        });

        const total = assignments.length;
        const submitted = assignments.filter((assignment) =>
          assignment.reports.some((report) =>
            (COMPLETED_REPORT_STATUSES as readonly string[]).includes(report.status),
          ),
        ).length;

        const remaining = total - submitted;
        const url = tutorPortalUrl(tutor.accessToken);
        const message = tutorReminder(tutor.fullName, url, month, remaining);

        return {
          tutorId: tutor.id,
          fullName: tutor.fullName,
          phone: tutor.phone,
          total,
          submitted,
          remaining,
          portalUrl: url,
          whatsappLink: remaining > 0 ? whatsappLink(tutor.phone, message) : null,
          reminderMessage: remaining > 0 ? message : null,
        };
      }),
    );

    const pending = submittedCount + reviewedCount;
    const notStarted = Math.max(0, expected - pending - draftCount - revisionCount);

    res.json({
      success: true,
      data: {
        month,
        monthLabel: formatMonth(month),
        availableMonths: recentMonths(12, currentMonth()).reverse(),
        stats: {
          totalTutors,
          activeTutors,
          totalStudents,
          activeStudents,
          totalCourses,
          expected,
          submitted: pending,
          pending: expected - pending,
          inProgress: draftCount,
          needsRevision: revisionCount,
          notStarted,
          completionRate: expected > 0 ? Math.round((pending / expected) * 100) : 0,
        },
        outstanding: {
          rows: tutorProgress
            .filter((entry) => entry.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining),
          complete: tutorProgress.filter((entry) => entry.remaining === 0).length,
          totalTutors: tutorProgress.length,
        },
        recent: recentReports.map((report) => toReportWithContext(report)),
        trend,
      },
    });
  }),
);

/** GET /api/admin/dashboard/history?months=6 — submission trend per month. */
dashboardRouter.get(
  "/history",
  validate({ query: historyQuerySchema }),
  asyncHandler(async (req, res) => {
    const months = recentMonths(Number(req.query.months ?? 6));
    const grouped = await prisma.report.groupBy({
      by: ["month", "status"],
      where: { month: { in: months } },
      _count: { _all: true },
    });

    const data = months.map((month) => {
      const rows = grouped.filter((row) => row.month === month);
      const byStatus = Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
      return {
        month,
        label: formatMonth(month),
        draft: byStatus.DRAFT ?? 0,
        submitted: byStatus.SUBMITTED ?? 0,
        reviewed: byStatus.REVIEWED ?? 0,
        needsRevision: byStatus.NEEDS_REVISION ?? 0,
        total: rows.reduce((sum, row) => sum + row._count._all, 0),
      };
    });

    res.json({ success: true, data });
  }),
);

/** GET /api/admin/dashboard/activity — recent admin activity. */
dashboardRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req);
    const [rows, total] = await Promise.all([
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.activityLog.count(),
    ]);
    res.json({
      success: true,
      data: { rows: rows.map(toActivityLogView), total, page: pagination.page, pageSize: pagination.pageSize },
    });
  }),
);