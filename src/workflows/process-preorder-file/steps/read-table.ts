import ExcelJS from 'exceljs';
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { loadWorkbookFromBuffer } from '../handle';


  type readTableDataStepInput = {
    headerRowIndex: number
    colMap: Record<string, number>
    sizeHeaders: string[]
    sizeColStartIndex: number
    seasonString: string
    fileData: {
        type: string;
        data: Buffer;
      }
  }

  export const readTableDataStep = createStep(
    "read-table-data",
    async ( input:readTableDataStepInput ) => {

        const {

            headerRowIndex,
            colMap,
            sizeHeaders,
            sizeColStartIndex,
            seasonString
        } = input

        const  buffer = input.fileData.data

        const workbook = await loadWorkbookFromBuffer(buffer);
        const sheet = workbook.worksheets[0];


        const results: { skuKey: string; quantity: number }[] = [];
  
        for (let i = headerRowIndex + 1; i <= sheet.rowCount; i++) {
          const row = sheet.getRow(i);
          const values = row.values as any[];
      
          const article = values[colMap['Артикул']]?.toString()?.trim();
          const color = values[colMap['Код цвета']]?.toString()?.trim();
          if (!article || !color) continue;
      
          const baseKey = `${article}${color}`;
      
          for (let j = sizeColStartIndex; j < values.length; j++) {
            const size = sizeHeaders[j - sizeColStartIndex];
            const quantity = values[j];
            if (size && typeof quantity === 'number' && quantity > 0) {
              results.push({ skuKey: `${seasonString}${baseKey}${size}`, quantity });
            }
          }
        }
        
        return new StepResponse(results)

      }
    
)
