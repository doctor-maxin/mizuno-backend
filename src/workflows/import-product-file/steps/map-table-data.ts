


// @ts-nocheck
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ExcelJS from 'exceljs';
import { MappingJSON } from "../type/mapping";

type MapDataStepInput = {
  fileData: {
    type: string;
    data: Buffer;
  },
  mappingConfig: {
    name: string;
    path: string[];
    required: boolean;
  }[],
  seasonString: string
}

export const mapDataStep = createStep(
  "map-data",
  async ({ fileData, mappingConfig, seasonString }: MapDataStepInput, { container }) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileData.data);

    const worksheet = workbook.worksheets[0]

    const firstRow = worksheet.getRow(1);
    const resultListOfJSON: any[] = [];

    const headers = firstRow.values?.slice(1) ?? [];  

    const headerIndexMap = new Map<string, number>();

    headers.forEach((header, index) => {
        if (typeof header === 'string') {
            headerIndexMap.set(header.trim(), index + 1); 
        }
    });


    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; 

        const resultJSON: any = {};

        mappingConfig.forEach(mapping => {
            const columnIndex = headerIndexMap.get(mapping.name);
            if (columnIndex) {
                const cellValue = row.getCell(columnIndex).value;
                if (cellValue !== null && cellValue !== undefined) {
                    let currentObject = resultJSON;
                    for (let i = 0; i < mapping.path.length - 1; i++) {
                        const key = mapping.path[i];
                        if (!currentObject[key]) {
                            currentObject[key] = {};
                        }
                        currentObject = currentObject[key];
                    }
                    currentObject[mapping.path[mapping.path.length - 1]] = cellValue;
                }
            }
        });

        resultListOfJSON.push({...resultJSON, product: {...resultJSON.product, metadata: {...resultJSON.product?.metadata, season: seasonString}}});
    });



    return new StepResponse(resultListOfJSON)

  }
)

