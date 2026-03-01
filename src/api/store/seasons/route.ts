import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    const { data: categoriesQuery } = await query.graph({
        entity: "product_category",
        fields: [
            "id",
            "handle",
            "parent_category.id",
            "metadata",
            "title",
            "name",
        ],
    });

    const processQuery = categoriesQuery
        .filter((category) => category.metadata?.isSeasonRoot)
        .map((category) => ({
            id: category.id,
            name: category.name,
            handle: category.handle,
            image: category.metadata?.image || null,
        }));

    res.status(200).json({ seasons: processQuery });
}

//получаем список всех групп товаров из сезона и категории
//сортируем его по правилам - для этого нужно иметь в списке данные по названию, цене, количеству цветов, по-умолчанию - с учетом мерча
//после установленной сортировки получаем нужное количество групп для вывода на странице

// структура json

// артикул, цвета, цена, название, пол
