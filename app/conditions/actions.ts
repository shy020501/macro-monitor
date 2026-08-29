"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { validateConditionTree } from "@/lib/domain/conditions"
import {
  deleteConditionSet,
  persistConditionTree,
} from "@/lib/repositories/conditions"

export interface SaveConditionResult {
  success: boolean
  conditionId?: string
  message: string
  errors?: string[]
}

export async function saveConditionAction(
  input: unknown
): Promise<SaveConditionResult> {
  // Authentication is intentionally out of scope for this local-only MVP.
  // This public action still treats all client input as untrusted and validates it.
  const validation = validateConditionTree(input)
  if (!validation.success || !validation.tree) {
    return {
      success: false,
      message: "Condition validation failed.",
      errors: validation.errors,
    }
  }

  try {
    const conditionId = await persistConditionTree(validation.tree)
    revalidatePath("/")
    revalidatePath("/conditions")
    return { success: true, conditionId, message: "Condition saved." }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save condition.",
    }
  }
}

export async function deleteConditionAction(
  input: unknown
): Promise<SaveConditionResult> {
  // Authentication/ownership checks must be added here when auth is introduced.
  const parsedId = z.string().uuid().safeParse(input)
  if (!parsedId.success) {
    return { success: false, message: "Invalid condition id." }
  }

  try {
    await deleteConditionSet(parsedId.data)
    revalidatePath("/")
    revalidatePath("/conditions")
    return {
      success: true,
      conditionId: parsedId.data,
      message: "Condition deleted.",
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to delete condition.",
    }
  }
}
