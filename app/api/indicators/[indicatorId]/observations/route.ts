import { z } from "zod"

import { getIndicatorObservations } from "@/lib/repositories/indicators"

const paramsSchema = z.object({ indicatorId: z.string().uuid() })
const limitSchema = z.coerce.number().int().min(1).max(100_002).optional()

export async function GET(
  request: Request,
  { params }: { params: Promise<{ indicatorId: string }> }
) {
  const parsedParams = paramsSchema.safeParse(await params)
  const parsedLimit = limitSchema.safeParse(
    new URL(request.url).searchParams.get("limit") ?? undefined
  )

  if (!parsedParams.success || !parsedLimit.success) {
    return Response.json({ error: "Invalid observation request." }, { status: 400 })
  }

  try {
    const observations = await getIndicatorObservations(
      parsedParams.data.indicatorId,
      parsedLimit.data
    )
    return Response.json(
      { observations },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load observations.",
      },
      { status: 500 }
    )
  }
}
