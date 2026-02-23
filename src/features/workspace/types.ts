export type EcnWorkGroup = {
  id: string;
  name: string;
  owner: string;
  defaultTemplateId: string;
};

export type EcnTaskRouteTemplate = {
  id: string;
  name: string;
  tasks: string[];
};

export type EcnRoutingRow = {
  id: string;
  itemId: string;
  partNumber: string;
  name: string;
  itemType: "product" | "raw material" | "service";
};

export type EcnWorkGroupAssignment = {
  required: boolean;
  templateId: string;
  tasks: string[];
};
