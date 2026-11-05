import { cookies } from "next/headers";
import { validSession } from "./security";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function owner() {
  if (!validSession((await cookies()).get("giftbox_owner")?.value))
    throw new HttpError(401, "Please sign in.");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  if (
    !origin ||
    (origin !== expected && origin !== new URL(request.url).origin)
  )
    throw new HttpError(403, "Please submit this form from Giftbox.");
}
export async function api(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: privateHeaders },
      );
    if (error instanceof ZodError)
      return Response.json(
        { error: error.issues[0]?.message || "Check the form fields." },
        { status: 400, headers: privateHeaders },
      );
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "Please submit a valid form." },
        { status: 400, headers: privateHeaders },
      );
    console.error(
      "Giftbox request failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      {
        error:
          "Something went wrong. Your changes may have been saved; refresh before trying again.",
      },
      { status: 500, headers: privateHeaders },
    );
  }
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
