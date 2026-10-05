import type { Admin, Student, Tutor } from "@prisma/client";
import type { TutorCardStatus } from "@prisma/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present on every route behind `requireAdmin`. */
      admin?: Pick<Admin, "id" | "name" | "email" | "role" | "isActive">;
      /** Present on every route behind `requireTutor`. */
      tutor?: Tutor;
    }
  }
}

export type { Student, TutorCardStatus };