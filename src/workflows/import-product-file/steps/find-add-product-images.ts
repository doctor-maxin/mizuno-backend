// src/workflows/my-workflow/steps/step-two.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ExcelJS from 'exceljs';
import B2bModuleService from "../../../modules/b2b/service";



export const findAddImagesStep = createStep(
  "find-add-product-images",
  async ({ listOfProducts, seasonString }: any, { container }) => {


    const b2bModuleService: B2bModuleService = container.resolve("b2b")

    const listOfS3Files = await b2bModuleService.listFiles(String(seasonString))

    const bucketName = process.env.S3_BUCKET
    const endpoint = process.env.S3_ENDPOINT

    function findAndSortImages(files, searchPattern) {
      const regex = new RegExp(`${searchPattern}(?:_(\\d+))?`); 
      const matchedFiles = [];

      files.forEach(key => {
        const match = key.match(regex);
        if (match) {
          const index = match[1] !== undefined ? parseInt(match[1], 10) : null; 
          matchedFiles.push({ key, index });
        }
      });

      matchedFiles.sort((a, b) => {
        if (a.index === null) return 1; 
        if (b.index === null) return -1;
        return a.index - b.index;
      });

      const noSuffixIndex = matchedFiles.findIndex(f => f.index === null);
      if (noSuffixIndex > -1) {
        const [noSuffixFile] = matchedFiles.splice(noSuffixIndex, 1);
        matchedFiles.splice(1, 0, noSuffixFile); 
      }

      return matchedFiles.map(file => endpoint + "/" + bucketName + "/" + file.key);
    }

    const productDataWithImages = listOfProducts.map(product => {
      const images = findAndSortImages(listOfS3Files, product.metadata.product_code_color_code).map(item => ({
        url: item
      }))
      return {
        ...product,
        thumbnail: images.length ? images[0].url : null,
        images
      }
    })

    return new StepResponse(productDataWithImages)


  }
)