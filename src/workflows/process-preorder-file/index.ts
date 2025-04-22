import {  createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { readTableDataStep } from "./steps/read-table";
import { handleTableStep } from "./steps/handle-table";


type SkuEntry = { skuKey: string; quantity: number };
type Mode = 'read' | 'write';

type WorkflowInput = {
    fileData: {
      type: string;
      data: Buffer;
    },
    mode: Mode
    dataToWrite?: SkuEntry[]
    seasonString: string
  }

  type handleTableStepInput = {
    buffer: Buffer
  }

export const processPreorderFile = createWorkflow(
    "parse-preorder-file",
    (input: WorkflowInput) => {

        const handleResult = handleTableStep(input.fileData.data)

        const inputHandleData = transform({handleResult, input},(data) => ({...data.handleResult, ...data.input}) )

        const readResults = when(inputHandleData, (input) => input.mode == "read")
        .then(() => {
          const stepResult = readTableDataStep(inputHandleData)
          return stepResult
        })

        return new WorkflowResponse({message: "ok", readResults})

    }

)


