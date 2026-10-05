import { Router } from "express";
import { requireAdmin } from "../../middleware/auth-admin.js";
import { authRouter } from "./auth/auth.routes.js";
import { adminsRouter } from "./admins/admin.routes.js";
import { tutorsRouter } from "./tutors/tutor.routes.js";
import { studentsRouter } from "./students/student.routes.js";
import { coursesRouter } from "./courses/course.routes.js";
import { assignmentsRouter } from "./assignments/assignment.routes.js";
import { reportsRouter } from "./reports/report.routes.js";
import { importRouter } from "./import/import.routes.js";
import { dashboardRouter } from "./dashboard/dashboard.routes.js";

/**
 * `/api/admin/*` — the admin app's entire surface.
 *
 * Deployed on its own origin (ADMIN_ORIGIN). The tutor app never links here,
 * never receives a token for here, and CORS refuses this origin on the tutor
 * routes — the two portals share no route, no session and no credential.
 */
export const adminRouter: Router = Router();

// Unauthenticated: only login, and even that is rate limited + locked out.
adminRouter.use("/auth", authRouter);

// Everything below requires a valid admin session cookie.
adminRouter.use(requireAdmin);

adminRouter.use("/dashboard", dashboardRouter);
adminRouter.use("/admins", adminsRouter); // additionally requires SUPER_ADMIN
adminRouter.use("/tutors", tutorsRouter);
adminRouter.use("/students", studentsRouter);
adminRouter.use("/courses", coursesRouter);
adminRouter.use("/assignments", assignmentsRouter);
adminRouter.use("/reports", reportsRouter);
adminRouter.use("/import", importRouter);

/** A cheap "what can I do" endpoint for the admin app's navigation. */
adminRouter.get("/me", (req, res) => {
  res.json({ success: true, data: { admin: req.admin } });
});