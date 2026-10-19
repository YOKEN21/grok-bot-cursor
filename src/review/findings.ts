export const FINDINGS_SCHEMA_NAME = "review_findings";

export const findingsSchema: object = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "path", "message"],
        properties: {
          severity: { type: "string", enum: ["blocking", "suggestion"] },
          path: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

export type Finding = {
  severity: "blocking" | "suggestion";
  path: string;
  message: string;
};

export type FindingsDocument = {
  summary: string;
  findings: Finding[];
};
