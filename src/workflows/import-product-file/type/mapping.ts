export interface MappingJSON {
    options: {
        title: string;
    }[]
    variants: { 
        options: Record<string, string>;
        title: string;
        prices: [{
            amount: number;
            currency_code: string;
        }],
        metadata: { 
            product_color_code: string; 
        } }[]
    metadata: { [key: string]: any };
}