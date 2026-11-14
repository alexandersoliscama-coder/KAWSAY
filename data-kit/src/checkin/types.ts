export type Scalar = string | number | boolean;
export interface FieldDef {
  path: string;
  label: string;
  type: "boolean" | "number" | "enum";
  group: string;
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
}
