<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# Детальный алгоритм интеграции MeiliSearch с Medusa JS

В данном руководстве представлен пошаговый алгоритм интеграции поисковой системы MeiliSearch с бэкендом Medusa JS, включая настройку индексации как стандартных товаров, так и кастомных сущностей при помощи системы событий.

## Общий обзор решения

Интеграция MeiliSearch с Medusa JS для индексации товаров и кастомных сущностей выполняется через следующие основные шаги:

1. Установка и настройка MeiliSearch
2. Установка и настройка плагина medusa-plugin-meilisearch
3. Создание кастомной сущности в Medusa JS
4. Создание сервиса для работы с кастомной сущностью
5. Создание подписчиков на события создания/обновления сущностей
6. Настройка индексации кастомных сущностей в MeiliSearch
7. Тестирование интеграции

Рассмотрим каждый шаг подробно с примерами кода.

## Шаг 1: Установка и настройка MeiliSearch

### Установка MeiliSearch

```bash
# Установка через curl
curl -L https://install.meilisearch.com | sh

# Запуск MeiliSearch
./meilisearch
```

Альтернативно можно использовать Docker:

```bash
docker run -p 7700:7700 -v $(pwd)/meili_data:/meili_data getmeili/meilisearch
```


### Проверка установки

После установки MeiliSearch будет доступен по адресу http://localhost:7700. Вы можете открыть этот адрес в браузере, чтобы увидеть интерфейс MeiliSearch[^1].

## Шаг 2: Установка и настройка плагина medusa-plugin-meilisearch

### Установка плагина

```bash
npm install medusa-plugin-meilisearch
```

или

```bash
yarn add medusa-plugin-meilisearch
```


### Настройка переменных окружения

Добавьте следующие переменные в файл `.env`:

```
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=ваш_мастер_ключ
```


### Настройка плагина в medusa-config.js

```javascript
const plugins = [
  // ... другие плагины
  {
    resolve: `medusa-plugin-meilisearch`,
    options: {
      config: {
        host: process.env.MEILISEARCH_HOST,
        apiKey: process.env.MEILISEARCH_API_KEY,
      },
      settings: {
        // Настройка для стандартных товаров
        products: {
          indexSettings: {
            searchableAttributes: [
              "title", 
              "description", 
              "variant_sku"
            ],
            displayedAttributes: [
              "title", 
              "description", 
              "variant_sku", 
              "thumbnail", 
              "handle"
            ],
            filterableAttributes: [
              "categories.handle", 
              "variants.prices.amount"
            ],
          },
          primaryKey: "id",
          transformer: (product) =&gt; ({
            id: product.id,
            title: product.title,
            description: product.description,
            thumbnail: product.thumbnail,
            handle: product.handle,
            variant_sku: product.variants.map(v =&gt; v.sku),
            categories: product.categories,
            variants: product.variants,
          }),
        },
        // Здесь будем добавлять настройки для кастомной сущности
      },
    },
  },
]
```

Эта базовая конфигурация уже обеспечивает индексацию стандартных товаров Medusa в MeiliSearch[^4].

## Шаг 3: Создание кастомной сущности в Medusa JS

### Создание модели кастомной сущности

Создайте файл `src/models/custom-entity.ts`:

```typescript
import { BeforeInsert, Column, Entity } from "typeorm";
import { BaseEntity } from "@medusajs/medusa";
import { generateEntityId } from "@medusajs/medusa/dist/utils";

@Entity()
export class CustomEntity extends BaseEntity {
  @Column({ type: "varchar" })
  name: string;
  
  @Column({ type: "varchar" })
  description: string;
  
  @Column({ type: "jsonb", nullable: true })
  metadata: Record&lt;string, unknown&gt;;
  
  @BeforeInsert()
  private beforeInsert(): void {
    this.id = generateEntityId(this.id, "custom");
  }
}
```


### Создание миграции для кастомной сущности

```bash
npx typeorm migration:create -n CustomEntity --dir src/migrations
```

Добавьте в созданный файл миграции следующее содержимое:

```typescript
import { MigrationInterface, QueryRunner } from "typeorm"

export class CustomEntity1234567891234 implements MigrationInterface {
  name = "CustomEntity1234567891234"
  
  public async up(queryRunner: QueryRunner): Promise&lt;void&gt; {
    await queryRunner.query(
      `CREATE TABLE "custom_entity" (
        "id" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "description" character varying NOT NULL,
        "metadata" jsonb
      )`
    )
    
    await queryRunner.query(
      `ALTER TABLE "custom_entity" ADD CONSTRAINT "PK_custom_entity" PRIMARY KEY ("id")`
    )
  }
  
  public async down(queryRunner: QueryRunner): Promise&lt;void&gt; {
    await queryRunner.query(`DROP TABLE "custom_entity"`)
  }
}
```


### Выполнение миграции

```bash
npm run build
npx medusa migrations run
```

Эти шаги создадут новую таблицу для кастомной сущности в базе данных Medusa[^7].

## Шаг 4: Создание репозитория и сервиса для кастомной сущности

### Создание репозитория

Создайте файл `src/repositories/custom-entity.ts`:

```typescript
import { EntityRepository, Repository } from "typeorm";
import { CustomEntity } from "../models/custom-entity";

@EntityRepository(CustomEntity)
export class CustomEntityRepository extends Repository&lt;CustomEntity&gt; {}
```


### Создание сервиса

Создайте файл `src/services/custom-entity.ts`:

```typescript
import { TransactionBaseService } from "@medusajs/medusa";
import { CustomEntity } from "../models/custom-entity";
import { EntityManager } from "typeorm";
import { EventBusService } from "@medusajs/medusa";

// Определение типов событий
export const CUSTOM_ENTITY_CREATED_EVENT = "custom-entity.created";
export const CUSTOM_ENTITY_UPDATED_EVENT = "custom-entity.updated";
export const CUSTOM_ENTITY_DELETED_EVENT = "custom-entity.deleted";

class CustomEntityService extends TransactionBaseService {
  protected manager_: EntityManager;
  protected transactionManager_: EntityManager;
  protected customEntityRepository_: typeof CustomEntityRepository;
  protected eventBusService_: EventBusService;

  constructor({ 
    manager, 
    customEntityRepository, 
    eventBusService 
  }) {
    super(arguments[^0]);
    
    this.manager_ = manager;
    this.customEntityRepository_ = customEntityRepository;
    this.eventBusService_ = eventBusService;
  }

  /**
   * Создание новой кастомной сущности
   */
  async create(data) {
    return await this.atomicPhase_(async (manager) =&gt; {
      const customEntityRepo = manager.getCustomRepository(this.customEntityRepository_);
      
      const customEntity = customEntityRepo.create(data);
      const result = await customEntityRepo.save(customEntity);
      
      // Вызываем событие создания сущности
      await this.eventBusService_.emit(CUSTOM_ENTITY_CREATED_EVENT, {
        id: result.id
      });
      
      return result;
    });
  }

  /**
   * Обновление существующей кастомной сущности
   */
  async update(id, data) {
    return await this.atomicPhase_(async (manager) =&gt; {
      const customEntityRepo = manager.getCustomRepository(this.customEntityRepository_);
      
      const customEntity = await this.retrieve(id);
      
      // Обновляем поля
      for (const [key, value] of Object.entries(data)) {
        if (key === "metadata" &amp;&amp; value !== undefined) {
          customEntity.metadata = this.setMetadata_(customEntity, value);
          continue;
        }
        
        customEntity[key] = value;
      }
      
      const result = await customEntityRepo.save(customEntity);
      
      // Вызываем событие обновления сущности
      await this.eventBusService_.emit(CUSTOM_ENTITY_UPDATED_EVENT, {
        id: result.id
      });
      
      return result;
    });
  }

  /**
   * Получение кастомной сущности по id
   */
  async retrieve(id, config = {}) {
    const customEntityRepo = this.manager_.getCustomRepository(this.customEntityRepository_);
    
    const customEntity = await customEntityRepo.findOne({ where: { id } });
    
    if (!customEntity) {
      throw new Error(`CustomEntity with id: ${id} not found`);
    }
    
    return customEntity;
  }

  /**
   * Удаление кастомной сущности
   */
  async delete(id) {
    return await this.atomicPhase_(async (manager) =&gt; {
      const customEntityRepo = manager.getCustomRepository(this.customEntityRepository_);
      
      const customEntity = await this.retrieve(id);
      
      await customEntityRepo.remove(customEntity);
      
      // Вызываем событие удаления сущности
      await this.eventBusService_.emit(CUSTOM_ENTITY_DELETED_EVENT, {
        id
      });
      
      return {
        id,
        object: "custom_entity",
        deleted: true
      };
    });
  }

  /**
   * Получение списка кастомных сущностей
   */
  async list(selector = {}, config = { relations: [], skip: 0, take: 20 }) {
    const customEntityRepo = this.manager_.getCustomRepository(this.customEntityRepository_);
    
    const query = this.buildQuery_(selector, config);
    
    return await customEntityRepo.find(query);
  }

  /**
   * Вспомогательный метод для обновления метаданных
   */
  setMetadata_(entity, metadata) {
    const existing = entity.metadata || {};
    const newMetadata = {};
    
    for (const [key, value] of Object.entries(existing)) {
      if (metadata[key] !== undefined) {
        newMetadata[key] = metadata[key];
      } else {
        newMetadata[key] = value;
      }
    }
    
    for (const [key, value] of Object.entries(metadata)) {
      if (existing[key] === undefined) {
        newMetadata[key] = value;
      }
    }
    
    return newMetadata;
  }
}

export default CustomEntityService;
```

Сервис содержит методы для работы с кастомной сущностью и вызывает события при создании, обновлении и удалении записей[^10].

## Шаг 5: Настройка индексации кастомных сущностей в MeiliSearch

### Обновление конфигурации плагина MeiliSearch

Обновите настройки плагина в `medusa-config.js`, добавив конфигурацию для кастомной сущности:

```javascript
const plugins = [
  // ... другие плагины
  {
    resolve: `medusa-plugin-meilisearch`,
    options: {
      config: {
        host: process.env.MEILISEARCH_HOST,
        apiKey: process.env.MEILISEARCH_API_KEY,
      },
      settings: {
        // Конфигурация для стандартных товаров
        products: {
          // ... настройки товаров
        },
        // Добавляем конфигурацию для кастомной сущности
        custom_entities: {
          indexSettings: {
            searchableAttributes: [
              "name", 
              "description"
            ],
            displayedAttributes: [
              "id",
              "name", 
              "description", 
              "metadata"
            ],
            filterableAttributes: [
              "metadata.category"
            ],
          },
          primaryKey: "id",
          transformer: (customEntity) =&gt; ({
            id: customEntity.id,
            name: customEntity.name,
            description: customEntity.description,
            metadata: customEntity.metadata,
          }),
        },
      },
    },
  },
]
```

Эта конфигурация определяет, какие поля кастомной сущности будут индексироваться и как данные будут трансформироваться перед индексацией[^4].

## Шаг 6: Создание подписчиков для индексации кастомных сущностей

### Создание подписчика на событие создания кастомной сущности

Создайте файл `src/subscribers/custom-entity-created.ts`:

```typescript
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { CUSTOM_ENTITY_CREATED_EVENT } from "../services/custom-entity";

export default async function customEntityCreatedHandler({
  event,
  container,
}: SubscriberArgs&lt;{ id: string }&gt;) {
  const customEntityService = container.resolve("customEntityService");
  const searchService = container.resolve("searchService");
  const logger = container.resolve("logger");
  
  logger.info(`Индексация новой кастомной сущности: ${event.data.id}`);
  
  try {
    // Получаем данные кастомной сущности
    const customEntity = await customEntityService.retrieve(event.data.id);
    
    // Индексируем кастомную сущность в MeiliSearch
    await searchService.addDocuments(
      "custom_entities", 
      [customEntity], 
      "custom_entity"
    );
    
    logger.info(`Кастомная сущность ${customEntity.id} успешно проиндексирована`);
  } catch (error) {
    logger.error(
      `Ошибка при индексации кастомной сущности ${event.data.id}: ${error.message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: CUSTOM_ENTITY_CREATED_EVENT,
  context: {
    subscriberId: "custom-entity-created-indexer",
  },
};
```


### Создание подписчика на событие обновления кастомной сущности

Создайте файл `src/subscribers/custom-entity-updated.ts`:

```typescript
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { CUSTOM_ENTITY_UPDATED_EVENT } from "../services/custom-entity";

export default async function customEntityUpdatedHandler({
  event,
  container,
}: SubscriberArgs&lt;{ id: string }&gt;) {
  const customEntityService = container.resolve("customEntityService");
  const searchService = container.resolve("searchService");
  const logger = container.resolve("logger");
  
  logger.info(`Обновление индекса для кастомной сущности: ${event.data.id}`);
  
  try {
    // Получаем данные кастомной сущности
    const customEntity = await customEntityService.retrieve(event.data.id);
    
    // Обновляем данные в индексе MeiliSearch
    await searchService.replaceDocuments(
      "custom_entities", 
      [customEntity], 
      "custom_entity"
    );
    
    logger.info(`Кастомная сущность ${customEntity.id} успешно обновлена в индексе`);
  } catch (error) {
    logger.error(
      `Ошибка при обновлении индекса для кастомной сущности ${event.data.id}: ${error.message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: CUSTOM_ENTITY_UPDATED_EVENT,
  context: {
    subscriberId: "custom-entity-updated-indexer",
  },
};
```


### Создание подписчика на событие удаления кастомной сущности

Создайте файл `src/subscribers/custom-entity-deleted.ts`:

```typescript
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { CUSTOM_ENTITY_DELETED_EVENT } from "../services/custom-entity";

export default async function customEntityDeletedHandler({
  event,
  container,
}: SubscriberArgs&lt;{ id: string }&gt;) {
  const searchService = container.resolve("searchService");
  const logger = container.resolve("logger");
  
  logger.info(`Удаление кастомной сущности из индекса: ${event.data.id}`);
  
  try {
    // Удаляем кастомную сущность из индекса MeiliSearch
    await searchService.deleteDocument(
      "custom_entities", 
      event.data.id
    );
    
    logger.info(`Кастомная сущность ${event.data.id} успешно удалена из индекса`);
  } catch (error) {
    logger.error(
      `Ошибка при удалении кастомной сущности ${event.data.id} из индекса: ${error.message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: CUSTOM_ENTITY_DELETED_EVENT,
  context: {
    subscriberId: "custom-entity-deleted-indexer",
  },
};
```

Эти подписчики реагируют на события, связанные с кастомной сущностью, и выполняют необходимые операции с индексом MeiliSearch[^5][^8].

## Шаг 7: Начальная загрузка данных в индекс MeiliSearch

Для начальной загрузки существующих кастомных сущностей в MeiliSearch создайте файл `src/loaders/meilisearch.ts`:

```typescript
import { MedusaApp } from "@medusajs/medusa";

export default async (app: MedusaApp): Promise&lt;void&gt; =&gt; {
  const searchService = app.container.resolve("searchService");
  const customEntityService = app.container.resolve("customEntityService");
  const logger = app.container.resolve("logger");
  
  logger.info("Инициализация индексов MeiliSearch...");
  
  try {
    // Создаем индекс для кастомных сущностей
    await searchService.createIndex("custom_entities", {
      primaryKey: "id",
    });
    
    // Загружаем настройки для индекса
    const settings = app.options.plugins
      .find(p =&gt; p.resolve === "medusa-plugin-meilisearch")
      ?.options?.settings?.custom_entities?.indexSettings;
    
    if (settings) {
      await searchService.updateSettings("custom_entities", settings);
    }
    
    // Загружаем все существующие кастомные сущности
    const customEntities = await customEntityService.list({}, { take: 1000 });
    
    if (customEntities.length &gt; 0) {
      logger.info(`Загрузка ${customEntities.length} кастомных сущностей в индекс...`);
      
      await searchService.addDocuments(
        "custom_entities", 
        customEntities, 
        "custom_entity"
      );
      
      logger.info("Кастомные сущности успешно загружены в индекс MeiliSearch");
    } else {
      logger.info("Кастомных сущностей не найдено, индекс создан пустым");
    }
  } catch (error) {
    logger.error(`Ошибка при инициализации MeiliSearch: ${error.message}`);
  }
};
```

Этот загрузчик будет выполнен при запуске Medusa и обеспечит начальную индексацию существующих данных.

## Шаг 8: Тестирование интеграции

### Проверка работы индексации товаров

Для проверки работы индексации товаров можно создать новый товар через админ-панель Medusa или через API:

```bash
curl -X POST localhost:9000/admin/products \
  -H 'Authorization: Bearer {your_api_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Тестовый товар",
    "description": "Описание тестового товара",
    "options": [{"title": "Размер"}],
    "variants": [{
      "title": "Вариант товара",
      "prices": [{"amount": 1000, "currency_code": "rub"}],
      "options": [{"value": "S"}]
    }]
  }'
```


### Тестирование работы с кастомными сущностями

Для тестирования работы с кастомными сущностями создайте маршрут API для взаимодействия с кастомными сущностями:

Создайте файл `src/api/routes/custom-entities/index.ts`:

```typescript
import { Router } from "express";
import middlewares from "../../../api/middlewares";

const router = Router();

export default (app) =&gt; {
  app.use("/custom-entities", router);
  
  // Получить список кастомных сущностей
  router.get("/", async (req, res) =&gt; {
    const customEntityService = req.scope.resolve("customEntityService");
    
    const customEntities = await customEntityService.list(
      req.query.q ? { name: req.query.q } : {},
      {
        take: parseInt(req.query.limit) || 20,
        skip: parseInt(req.query.offset) || 0,
      }
    );
    
    res.json({ custom_entities: customEntities });
  });
  
  // Создать новую кастомную сущность
  router.post("/", middlewares.wrap(async (req, res) =&gt; {
    const customEntityService = req.scope.resolve("customEntityService");
    
    const { name, description, metadata } = req.body;
    
    const customEntity = await customEntityService.create({
      name,
      description,
      metadata,
    });
    
    res.status(201).json({ custom_entity: customEntity });
  }));
  
  // Получить кастомную сущность по ID
  router.get("/:id", middlewares.wrap(async (req, res) =&gt; {
    const customEntityService = req.scope.resolve("customEntityService");
    
    const customEntity = await customEntityService.retrieve(req.params.id);
    
    res.json({ custom_entity: customEntity });
  }));
  
  // Обновить кастомную сущность
  router.put("/:id", middlewares.wrap(async (req, res) =&gt; {
    const customEntityService = req.scope.resolve("customEntityService");
    
    const { name, description, metadata } = req.body;
    
    const customEntity = await customEntityService.update(req.params.id, {
      name,
      description,
      metadata,
    });
    
    res.json({ custom_entity: customEntity });
  }));
  
  // Удалить кастомную сущность
  router.delete("/:id", middlewares.wrap(async (req, res) =&gt; {
    const customEntityService = req.scope.resolve("customEntityService");
    
    await customEntityService.delete(req.params.id);
    
    res.status(204).end();
  }));
  
  return router;
};
```


### Тестирование поиска по кастомным сущностям

Создайте файл `src/api/routes/custom-entities/search.ts`:

```typescript
import { Router } from "express";
import middlewares from "../../../api/middlewares";

const router = Router();

export default (app) =&gt; {
  app.use("/custom-entities/search", router);
  
  // Поиск по кастомным сущностям через MeiliSearch
  router.post("/", middlewares.wrap(async (req, res) =&gt; {
    const searchService = req.scope.resolve("searchService");
    
    const { q, filter, limit, offset } = req.body;
    
    const results = await searchService.search(
      "custom_entities",
      q,
      {
        filter,
        limit: limit || 20,
        offset: offset || 0,
      }
    );
    
    res.json(results);
  }));
  
  return router;
};
```


### Примеры запросов для тестирования:

1. Создание кастомной сущности:
```bash
curl -X POST localhost:9000/custom-entities \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Тестовая кастомная сущность",
    "description": "Описание тестовой кастомной сущности",
    "metadata": {
      "category": "test",
      "priority": 1
    }
  }'
```

2. Поиск по кастомным сущностям:
```bash
curl -X POST localhost:9000/custom-entities/search \
  -H 'Content-Type: application/json' \
  -d '{
    "q": "тестовая",
    "filter": "metadata.category = test"
  }'
```

Эти тесты позволят проверить корректность работы всей цепочки: от создания сущностей до их индексации и поиска по ним.

## Заключение

В данном руководстве мы рассмотрели полный процесс интеграции MeiliSearch с Medusa JS для индексации как стандартных товаров, так и кастомных сущностей. Ключевые моменты:

1. **Базовая интеграция**: Используем официальный плагин `medusa-plugin-meilisearch` для базовой интеграции и индексации стандартных товаров.
2. **Кастомные сущности**: Создаем кастомные сущности, репозитории и сервисы для работы с ними.
3. **События и подписчики**: Используем систему событий Medusa JS для реагирования на создание, обновление и удаление сущностей.
4. **Индексация**: Настраиваем автоматическую индексацию данных в MeiliSearch при изменении сущностей.
5. **API для поиска**: Создаем API-маршруты для поиска по проиндексированным данным.

Этот подход обеспечивает гибкую и масштабируемую архитектуру для интеграции поисковой системы с Medusa JS, позволяя легко добавлять новые типы сущностей и настраивать их индексацию[^4].

<div style="text-align: center">⁂</div>

[^1]: https://www.meilisearch.com/docs

[^2]: https://www.meilisearch.com

[^3]: https://help.meilisearch.com/en/article/how-to-setup-meilisearch-with-javascript-1ibu5s5/

[^4]: https://rigbyjs.com/blog/complete-guide-on-how-to-integrate-meilisearch-with-medusajs

[^5]: https://docs.medusajs.com/learn/fundamentals/events-and-subscribers

[^6]: https://www.npmjs.com/package/@rokmohar/medusa-plugin-meilisearch

[^7]: https://dev.to/dailydevtips1/creating-custom-entities-in-medusa-1p47

[^8]: https://docs.medusajs.com/v1/development/events/create-subscriber

[^9]: https://docs.medusajs.com/resources/examples

[^10]: https://docs.medusajs.com/v1/development/services/create-service

[^11]: https://directus.io/docs/tutorials/extensions/integrate-meilisearch-indexing-with-custom-hooks

[^12]: https://www.meilisearch.com/docs/reference/api/overview

[^13]: https://docs.medusajs.com/llms.txt

[^14]: https://python-sdk.meilisearch.com

[^15]: https://github.com/meilisearch/documentation

[^16]: https://www.npmjs.com/package/@kodio.io%2Fmedusa-js-fetch

[^17]: https://www.meilisearch.com/blog/documentation-crawler-release

[^18]: https://kvytechnology.com/blog/software/disadvantages-of-medusa-js/

[^19]: https://docs.medusajs.com/v1/plugins/search/meilisearch

[^20]: https://docs.medusajs.com/resources/recipes/subscriptions/examples/standard

[^21]: https://github.com/meilisearch/docs-scraper

[^22]: https://github.com/medusajs/medusa/releases

[^23]: https://medusajs.com/plugins/medusa-plugin-meilisearch/

[^24]: https://docs.medusajs.com/resources/architectural-modules/event

[^25]: https://help.meilisearch.com/en/category/getting-started-p7vlo4/

[^26]: https://medusajs.com/blog/custom-documentation-tools/

[^27]: https://dev.to/medusajs/blazing-fast-product-search-w-meilisearch-and-medusa-3dee

[^28]: https://docs.medusajs.com/v1/development/events/subscribers

[^29]: https://dev.to/medusajs/blazing-fast-product-search-w-meilisearch-and-medusa-3dee?comments_sort=latest

[^30]: https://docs.medusajs.com/v1/development/search/create

[^31]: https://docs.medusajs.com/learn/fundamentals/plugins/create

[^32]: https://www.npmjs.com/package/medusa-plugin-meilisearch/v/2.0.0-snapshot-20230320172940

[^33]: https://docs.medusajs.com/v1/development/entities/create

[^34]: https://github.com/medusajs/medusa/issues/4027

[^35]: https://docs.medusajs.com/v1/development/plugins/create

[^36]: https://github.com/medusajs/medusa/discussions/3277

[^37]: https://dev.to/dailydevtips1/medusa-interacting-with-our-custom-entity-530e

[^38]: https://docs.medusajs.com/resources/references/event-service

[^39]: https://roadmap.meilisearch.com/c/84-personalization-contextual-search

[^40]: https://docs.medusajs.com/v1/development/plugins/publish

[^41]: https://github.com/medusajs/medusa/issues/9879

[^42]: https://github.com/medusajs/medusa/discussions/9576

[^43]: https://github.com/giangvo1125/medusa-meilisearch-plugin

[^44]: https://dev.to/dailydevtips1/creating-a-subscriber-in-medusa-ho6

[^45]: https://github.com/medusajs/medusa/issues/4089

[^46]: https://github.com/medusajs/medusa-starter-default/blob/master/src/subscribers/README.md

[^47]: https://github.com/medusajs/medusa/discussions/3965

[^48]: https://www.npmjs.com/package/medusa-extender/v/1.0.4

[^49]: https://docs.medusajs.com/resources/architectural-modules/event/create

[^50]: https://www.jsdelivr.com/package/npm/medusa-plugin-custom-meilisearch

[^51]: https://rigbyjs.com/blog/entities

[^52]: https://github.com/medusajs/medusa/issues/4105

[^53]: https://github.com/medusajs/medusa/issues/3964

[^54]: https://daily-dev-tips.com/posts/medusa-interacting-with-our-custom-entity/

[^55]: https://www.meilisearch.com/docs/learn/indexing/indexing_best_practices

[^56]: https://docs.medusajs.com/v1/development/entities/repositories

[^57]: https://www.meilisearch.com/docs/learn/getting_started/indexes

[^58]: https://stackoverflow.com/questions/75269182/how-to-add-a-custom-field-to-existing-entity-in-medusajs

[^59]: https://www.youtube.com/watch?v=XtBPLKiItgc

