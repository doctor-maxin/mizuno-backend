

// src/workflows/my-workflow/steps/step-two.ts
import { logger } from "@medusajs/framework";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createSlug } from "../../../utils/slug"
import { capitalize } from "../../../utils/text-format";
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

const COLORS = {
  "Белый": "#FFFFFF",
  "Серебряный": "#C0C0C0",
  "Серый": "#808080",
  "Черный": "#000000",
  "Красный": "#FF0000",
  "Темно-бордовый": "#800000",
  "Желтый": "#FFFF00",
  "Оливковый": "#808000",
  "Лайм": "#00FF00",
  "Зеленый": "#008000",
  "Морская волна": "#00FFFF",
  "Сине-зеленый": "#008080",
  "Синий": "#0000FF",
  "Темно-синий": "#000080",
  "Фуксия": "#FF00FF",
  "Фиолетовый": "#800080",
  "Коричневый": "#964B00"
}

const DEFAULT_COLOR = "#FFFFFF"



export const prepareDataStep = createStep(
  "group-prepare-product-data",
  async (input: any, { container }) => {

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
          options: { size: String(item.variant.options.size) },
          allow_backorder: true,
        },
        product: {
          ...item.product,
          metadata: {
            ...item.product.metadata,
            color_hex: COLORS[item.product.metadata.color_rus] || DEFAULT_COLOR,
            price: item.variant.prices[0].amount,
            color: item.variant.options.color,
            color_rus: item.product.metadata.color_rus,
            is_shoes: item.product?.metadata?.size_chart === 'A',
            category: item.product.metadata.category,
            gender: capitalize(item.product.metadata.gender)
          },
          title: title,
          handle: createSlug(item.product.metadata.season + ' ' + title),
          origin_country: item.product.metadata.country_of_origin || null,
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