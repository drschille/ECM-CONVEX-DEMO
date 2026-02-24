// Convex runtime accepts function name strings; using them here avoids depending on
// regenerated `convex/_generated/api` while the remote deployment still contains legacy data.
const fn = <T extends string>(name: T) => name as any;

export const api = {
  users: {
    bootstrapProfile: fn("users:bootstrapProfile"),
    myProfile: fn("users:myProfile"),
  },
  organizations: {
    listMyOrganizations: fn("organizations:listMyOrganizations"),
    get: fn("organizations:get"),
    create: fn("organizations:create"),
    bootstrapDefaultOrganization: fn("organizations:bootstrapDefaultOrganization"),
    listMembers: fn("organizations:listMembers"),
    updateMemberRole: fn("organizations:updateMemberRole"),
    addMemberByEmail: fn("organizations:addMemberByEmail"),
    getApprovalPolicy: fn("organizations:getApprovalPolicy"),
    upsertApprovalPolicy: fn("organizations:upsertApprovalPolicy"),
  },
  notifications: {
    listMine: fn("notifications:listMine"),
    unreadCount: fn("notifications:unreadCount"),
    markRead: fn("notifications:markRead"),
    markAllReadForOrg: fn("notifications:markAllReadForOrg"),
  },
  reports: {
    dashboard: fn("reports:dashboard"),
    changeRequestReport: fn("reports:changeRequestReport"),
    exportChangeRequestsCsv: fn("reports:exportChangeRequestsCsv"),
  },
  items: {
    list: fn("items:list"),
    get: fn("items:get"),
    create: fn("items:create"),
    update: fn("items:update"),
    listForPicker: fn("items:listForPicker"),
    listImports: fn("items:listImports"),
  },
  itemImports: {
    importItemsCsv: fn("itemImports:importItemsCsv"),
  },
  changeRequests: {
    list: fn("changeRequests:list"),
    getDetail: fn("changeRequests:getDetail"),
    create: fn("changeRequests:create"),
    update: fn("changeRequests:update"),
    transitionStatus: fn("changeRequests:transitionStatus"),
  },
  approvals: {
    listForChangeRequest: fn("approvals:listForChangeRequest"),
    approvalSummary: fn("approvals:approvalSummary"),
    decide: fn("approvals:decide"),
  },
  comments: {
    listForEntity: fn("comments:listForEntity"),
    add: fn("comments:add"),
  },
  attachments: {
    generateUploadUrl: fn("attachments:generateUploadUrl"),
    add: fn("attachments:add"),
    listForEntity: fn("attachments:listForEntity"),
    remove: fn("attachments:remove"),
  },
  eco: {
    get: fn("eco:get"),
    updateChecklist: fn("eco:updateChecklist"),
    recordSignoff: fn("eco:recordSignoff"),
  },
  audit: {
    list: fn("audit:list"),
    exportCsv: fn("audit:exportCsv"),
  },
  devSeed: {
    seedDemoData: fn("devSeed:seedDemoData"),
  },
} as const;
