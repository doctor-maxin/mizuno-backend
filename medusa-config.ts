import {
    loadEnv,
    defineConfig,
    Modules,
    ContainerRegistrationKeys,
} from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
    projectConfig: {
        databaseUrl: process.env.DATABASE_URL,
        http: {
            storeCors: process.env.STORE_CORS!,
            adminCors: process.env.ADMIN_CORS!,
            authCors: process.env.AUTH_CORS!,
            jwtSecret: process.env.JWT_SECRET || "supersecret",
            cookieSecret: process.env.COOKIE_SECRET || "supersecret",
            jwtExpiresIn: "30d",
            authMethodsPerActor: {
                user: ["emailpass", "otp-auth"],
                customer: ["otp-auth"],
                // manager: ["otp-auth"],
            },
        },
    },
    modules: [
        {
            resolve: "./src/modules/b2b",
        },
        {
            resolve: "./src/modules/manager",
        },
        {
            resolve: "@medusajs/medusa/file",
            options: {
                providers: [
                    {
                        resolve: "@medusajs/medusa/file-s3",
                        id: "s3",
                        options: {
                            file_url: process.env.S3_FILE_URL,
                            access_key_id: process.env.S3_ACCESS_KEY_ID,
                            secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                            region: process.env.S3_REGION,
                            bucket: process.env.S3_BUCKET,
                            endpoint: process.env.S3_ENDPOINT,
                            additional_client_config: {
                                forcePathStyle: true,
                            },
                        },
                    },
                ],
            },
        },
        {
            resolve: "@medusajs/medusa/auth",
            dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
            options: {
                providers: [
                    {
                        resolve: "@medusajs/medusa/auth-emailpass",
                        id: "emailpass",
                    },
                    {
                        resolve: "./src/modules/otp-auth",
                        id: "otp-auth",
                        options: {
                            jwtSecret: process.env.JWT_SECRET,
                        },
                    },
                ],
            },
        },
        {
            resolve: "@medusajs/medusa/notification",
            options: {
                providers: [
                    {
                        resolve: "@medusajs/medusa/notification-local",
                        id: "local",
                    },
                    {
                        resolve: "./src/modules/unisender",
                        id: "unisender",
                        options: {
                            channels: ["email"],
                            url: process.env.UNISENDER_URL,
                            apiKey: process.env.UNISENDER_API_KEY,
                            otpTemplate: process.env.UNISENDER_OTP_TEMPLATE,
                        },
                    },
                ],
            },
        },
    ],
    plugins: [
        {
            resolve: "@rokmohar/medusa-plugin-meilisearch",
            options: {
                config: {
                    host: process.env.MEILISEARCH_HOST ?? "",
                    apiKey: process.env.MEILISEARCH_API_KEY ?? "",
                },
                settings: {
                    // The key is used as the index name in Meilisearch
                    products: {
                        // Required: Index type
                        type: "products",
                        // Optional: Whether the index is enabled. When disabled:
                        // - Index won't be created or updated
                        // - Documents won't be added or removed
                        // - Index won't be included in searches
                        // - All operations will be silently skipped
                        enabled: true,
                        // Optional: Specify which fields to include in the index
                        // If not specified, all fields will be included
                        fields: [
                            "id",
                            "title",
                            "handle",
                            "category",
                            "thumbnail",
                            "metadata",
                        ],
                        indexSettings: {
                            searchableAttributes: ["title", "product_code"],
                            displayedAttributes: [
                                "id",
                                "handle",
                                "title",
                                "description",
                                "color_rus",
                                "thumbnail",
                                "color_hex",
                                "gender",
                                "product_code",
                                "color",
                                "price",
                            ],
                            sortableAttributes: ["title", "price"],
                            filterableAttributes: [
                                "id",
                                "handle",
                                "season",
                                "category",
                                "title",
                                "color_rus",
                                "gender",
                                "price",
                            ],
                        },
                        primaryKey: "id",
                        // Create your own transformer
                        transformer: (product) => {
                            return {
                                id: product.id,
                                title: product.metadata?.style_name,
                                color: product.metadata?.color,
                                category: product.metadata?.category,
                                season: product.metadata?.season,
                                tier: product.metadata?.tier,
                                thumbnail: product.thumbnail,
                                handle: product.handle,
                                price: product.metadata?.price,
                                color_rus: product.metadata?.color_rus,
                                color_hex: product.metadata?.color_hex,
                                gender: product.metadata?.gender,
                                product_code: product.metadata?.product_code,
                                // other attributes...
                            };
                        },
                    },
                    pgroups: {
                        type: "pgroups",
                        enabled: true,
                        fields: [
                            "id",
                            "product_ids",
                            "season_id",
                            "product_code",
                            "title",
                            "category",
                            "metadata",
                        ],
                        indexSettings: {
                            displayedAttributes: [
                                "id",
                                "thumbnail",
                                "product_ids",
                                "title",
                                "category",
                                "product_code",
                                "gender",
                                "tags",
                                "price",
                                "handle",
                                "colors",
                                "is_shoes",
                                "metadata",
                            ],
                            sortableAttributes: ["title", "price"],
                            filterableAttributes: [
                                "id",
                                "season_id",
                                "category",
                                "price",
                                "gender",
                                "colors",
                                "handle",
                            ],
                            searchableAttributes: [
                                "title",
                                "product_ids",
                                "product_code",
                                "colors",
                            ],
                        },
                        primaryKey: "id",
                        // Create your own transformer
                        transformer: (pgroup) => {
                            return {
                                id: pgroup.id,
                                product_ids: pgroup.product_ids,
                                season_id: pgroup.season_id,
                                category: pgroup.category,
                                product_code: pgroup.product_code,
                                title: pgroup.title,
                                handle: pgroup.metadata?.handle,
                                tags: pgroup.metadata?.tags,
                                thumbnail: pgroup.metadata?.thumbnail,
                                gender: pgroup.metadata?.gender,
                                price: pgroup.metadata?.price,
                                colors: pgroup.metadata?.colors,
                                is_shoes: pgroup.metadata?.is_shoes,
                            };
                        },
                    },
                },
            },
        },
    ],
    admin: {
        vite: (config) => {
            config.server.allowedHosts = [".medusa.mizuno-b2b.shch.one"];
            return config;
        },
    },
});
