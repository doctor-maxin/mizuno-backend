import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

const headerMappings = {
    requiredHeaders: {
        'EAN': ['variant', 'ean'],
        'Product Code': ['product', 'metadata', 'product_code'],
        'Style name': ['product', 'metadata', 'style_name'],
        'Size EU': ['variant', 'options', 'size'],
        'Product Colour Code': ['product', 'metadata', 'product_color_code'],
        'Colour': ['variant', 'options', 'color'],
        'RRP (RUB)': ['variant', 'price', 'amount'],
        'Product Code + Color Code': ['product', 'metadata', 'product_code_color_code'],
        'Size UK': ['variant','metadata', 'size_uk'],
        'Категория': ['product', 'metadata', 'category']
    },
    optionalHeaders: {
        'Цвет (рус)': ['variant', 'metadata', 'color_rus'],
        'Размерная сетка': ['product', 'metadata', 'size_chart'],
        'Size cm': ['variant','metadata', 'size_cm'],
        'Материал верх': ['product', 'metadata', 'material_upper'],
        'Материал подкладка': ['product', 'metadata', 'material_lining'],
        'Материал подошва': ['product', 'metadata', 'material_sole'],
        'Состав (одежда)': ['product', 'metadata', 'composition'],
        'Технологии': ['product', 'metadata', 'technologies'],
        'Gender': ['product', 'metadata', 'gender'],
        'Country of Origin': ['product', 'metadata', 'country_of_origin'],
        'Half Pair Weight  (g)': ['product', 'metadata', 'half_pair_weight_g'],
        'Tier': ['product', 'metadata', 'tier'],
        'Description': ['product', 'description']
    }
};


export const createMappingConfigStep = createStep(
    "create-mapping-config",
    async ({ }, { container }) => {

        function createMappingConfig(headerMappings: any): { name: string; path: string[]; required: boolean }[] {
            const result: { name: string; path: string[]; required: boolean }[] = [];
        
            for (const [header, path] of Object.entries(headerMappings.requiredHeaders)) {
                result.push({ name: header, path: path as string[], required: true });
            }
        
            for (const [header, path] of Object.entries(headerMappings.optionalHeaders)) {
                result.push({ name: header, path: path as string[], required: false });
            }
        
            return result;
        }

        const mappings = createMappingConfig(headerMappings);

        return new StepResponse(mappings)


    }
)