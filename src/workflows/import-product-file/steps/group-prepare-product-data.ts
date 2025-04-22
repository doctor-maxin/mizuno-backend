

// src/workflows/my-workflow/steps/step-two.ts
import { logger } from "@medusajs/framework";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

interface Variant {
  ean: string;
  options: Record<string, string | number>;
  price: { amount: number };
  metadata: Record<string, any>;
}

interface Product {
  metadata: Record<string, any>;
  season: string;
  title: string;
  handle: string;
  options?: OptionGroup[];
  variants?: Variant[];
}

interface OptionGroup {
  title: string;
  values: string[];
}

interface Item {
  variant: Variant;
  product: Product;
}


export const prepareDataStep = createStep(
  "group-prepare-product-data",
  async (input: any, { container }) => {


    function transliterate(text: string): string {
      const cyrillicToLatinMap: { [key: string]: string } = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
        'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return text.split('').map(char => cyrillicToLatinMap[char.toLowerCase()] || char).join('');
    }

    function createSlug(input: string): string {
      let slug = transliterate(input);

      slug = slug.toLowerCase();

      slug = slug.replace(/[\s\_\/]+/g, '-');

      slug = slug.replace(/[^\w\-]+/g, '');

      slug = slug.replace(/\-\-+/g, '-');

      slug = slug.replace(/^-+/, '').replace(/-+$/, '');

      return slug;
    }


    const itemsData = input.map(item => {
      const title = `${item.product.metadata.style_name} ${item.variant.options.color}`
      item.variant.prices = [{
        amount: item.variant.price.amount,
        currency_code: "rub"
      }]
      delete item.variant.price
      return {
        ...item,
        variant: {
          ...item.variant, 
          title: `${item.variant.options.size}, ${item.variant.options.color}`, 
          sku: (item?.product?.metadata?.season || "XXXX").toUpperCase() + item?.product?.metadata?.product_code_color_code + item?.variant?.metadata?.size_uk, 
          options: {size: String(item.variant.options.size)},
        },
        product: {
          ...item.product, 
          title: title, 
          handle: createSlug(item.product.metadata.season + ' ' + title),
          origin_country:  item.product.metadata.country_of_origin || null,
          weight: item.product.metadata.half_pair_weight_g || null,
          status: "published"
        }
      }


    })

    function groupVariants(items: Item[]) {
      const groupedItems: Record<string, Product> = {};

      items.forEach(item => {
        const { variant, product } = item;
        const productKey = product.handle;

        if (!groupedItems[productKey]) {
          groupedItems[productKey] = {
            ...product,
            options: [],
            variants: []
          };
        }

        groupedItems[productKey].variants!.push(variant);

        for (const [optionKey, optionValue] of Object.entries(variant.options)) {
          const optionValueStr = String(optionValue);

          let optionGroup = groupedItems[productKey].options!.find(group => group.title === optionKey);

          if (!optionGroup) {
            optionGroup = { title: optionKey, values: [] };
            groupedItems[productKey].options!.push(optionGroup);
          }

          if (!optionGroup.values.includes(optionValueStr)) {
            optionGroup.values.push(optionValueStr);
          }
        }
      });

      return Object.values(groupedItems);
    }

    const data = groupVariants(itemsData)

    return new StepResponse(data)


  }
)