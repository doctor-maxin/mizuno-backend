import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { findHeaderRow, getHeaderColumnMap, getSizeHeaders, loadWorkbookFromBuffer } from '../handle';


export const handleTableStep = createStep(
    "handle-table",
    async (input: Buffer) => {

        const  buffer = input

        const workbook = await loadWorkbookFromBuffer(buffer);
        const sheet = workbook.worksheets[0];

        const headerRowIndex = findHeaderRow(sheet);
        const headerRow = sheet.getRow(headerRowIndex);
        const colMap = getHeaderColumnMap(headerRow);
        const sizeColStartIndex = Object.keys(colMap).length + 1;
        const sizeHeaders = getSizeHeaders(sheet, headerRowIndex, sizeColStartIndex);

        const results = { headerRowIndex, colMap, sizeHeaders, sizeColStartIndex }

        return new StepResponse(results)

    }

)
