import type {
  ConditionGroupNode,
  ConditionNode,
  ConditionRuleNode,
} from "@/lib/domain/conditions"

export function updateGroup(
  root: ConditionGroupNode,
  groupId: string,
  update: (group: ConditionGroupNode) => ConditionGroupNode
): ConditionGroupNode {
  if (root.id === groupId) return update(root)
  return {
    ...root,
    children: root.children.map((child) =>
      child.kind === "group" ? updateGroup(child, groupId, update) : child
    ),
  }
}

export function updateRule(
  root: ConditionGroupNode,
  ruleId: string,
  update: (rule: ConditionRuleNode) => ConditionRuleNode
): ConditionGroupNode {
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.kind === "group") return updateRule(child, ruleId, update)
      return child.id === ruleId ? update(child) : child
    }),
  }
}

export function addChild(
  root: ConditionGroupNode,
  groupId: string,
  child: ConditionNode
): ConditionGroupNode {
  return updateGroup(root, groupId, (group) => ({
    ...group,
    children: [...group.children, child],
  }))
}

export function removeNode(
  root: ConditionGroupNode,
  nodeId: string
): ConditionGroupNode {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== nodeId)
      .map((child) =>
        child.kind === "group" ? removeNode(child, nodeId) : child
      ),
  }
}
