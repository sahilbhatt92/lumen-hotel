declare module "operations/OperationsDesk" {
  import type { ComponentType } from "react";
  import type { DeskSection } from "@lumen/domain";

  export interface OperationsDeskProps {
    section: DeskSection;
    focusId?: string | null;
  }

  const Desk: ComponentType<OperationsDeskProps>;
  export default Desk;
}
