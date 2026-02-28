import {
    createWorkflow,
    createStep,
    StepResponse,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows";
import ManagerModuleService from "../../modules/manager/service";

type CreateManagerWorkflowInput = {
    manager: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
    };
    authIdentityId: string;
};

const createManagerStep = createStep(
    "create-manager-step",
    async (
        { manager: managerData }: Pick<CreateManagerWorkflowInput, "manager">,
        { container },
    ) => {
        const managerModuleService: ManagerModuleService =
            container.resolve("manager");

        const manager = await managerModuleService.createManager(managerData);

        return new StepResponse(manager);
    },
);

const createManagerWorkflow = createWorkflow(
    "create-manager",
    function (input: CreateManagerWorkflowInput) {
        const manager = createManagerStep({
            manager: input.manager,
        });

        setAuthAppMetadataStep({
            authIdentityId: input.authIdentityId,
            actorType: "manager",
            value: manager.id,
        });

        return new WorkflowResponse(manager);
    },
);

export default createManagerWorkflow;
