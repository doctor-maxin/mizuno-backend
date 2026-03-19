// @ts-nocheck
// src/workflows/my-workflow/steps/step-two.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ExcelJS from 'exceljs';

type TestFileStepInput = {
  fileData: {
    type: string;
    data: Buffer;
  },
  mappingConfig: {
    name: string;
    path: string[];
    required: boolean;
  }[]
}

export const testFileStep = createStep(
  "test-file",
  async ({ fileData, mappingConfig }: TestFileStepInput, { container }) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileData.data);

    const worksheet = workbook.worksheets[0]

    const firstRow = worksheet.getRow(1);
    if (!firstRow) new StepResponse(false)

      const headers = firstRow.values?.slice(1) ?? [];  

      const headerIndexMap = new Map<string, number>();

      headers.forEach((header, index) => {
          if (typeof header === 'string') {
              headerIndexMap.set(header, index + 1); 
          }
      });
  
      const missingHeaders = mappingConfig
          .filter(mapping => mapping.required && !headerIndexMap.has(mapping.name))
          .map(mapping => mapping.name);

    if (missingHeaders.length > 0) {
      return new StepResponse({status: false, message: `Отсутствуют обязательные заголовки: ${missingHeaders.join(', ')}`});
    }

    return new StepResponse({status: true})


  }
)