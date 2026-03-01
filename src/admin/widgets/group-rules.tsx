import { defineWidgetConfig } from "@medusajs/admin-sdk";
import {
    Button,
    Container,
    Heading,
    Input,
    Label,
    Select,
    Textarea,
    Text,
} from "@medusajs/ui";
import type {
    AdminCustomerGroup,
    DetailWidgetProps,
} from "@medusajs/framework/types";
import { useEffect, useMemo, useState } from "react";

const RULES_TEXT_KEY = "rules_text";
const PURCHASE_CATEGORIES_KEY = "purchase_categories";
const GROUP_TYPE_KEY = "type";

const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
};

const CustomerGroupWidget = ({
    data,
}: DetailWidgetProps<AdminCustomerGroup>) => {
    const metadata = useMemo(
        () =>
            data?.metadata && typeof data.metadata === "object"
                ? data.metadata
                : {},
        [data?.metadata],
    );
    const [rulesText, setRulesText] = useState<string>("");
    const [purchaseCategories, setPurchaseCategories] = useState<string[]>([
        "",
    ]);
    const [groupType, setGroupType] = useState<"default" | "discount">(
        "default",
    );
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const initialRulesText =
            typeof metadata[RULES_TEXT_KEY] === "string"
                ? metadata[RULES_TEXT_KEY]
                : "";
        const initialCategories = toStringArray(
            metadata[PURCHASE_CATEGORIES_KEY],
        );
        const initialType =
            metadata[GROUP_TYPE_KEY] === "discount" ? "discount" : "default";

        setRulesText(initialRulesText);
        setPurchaseCategories(
            initialCategories.length ? initialCategories : [""],
        );
        setGroupType(initialType);
    }, [metadata]);

    const onChangeCategory = (index: number, value: string) => {
        setPurchaseCategories((current) =>
            current.map((item, idx) => (idx === index ? value : item)),
        );
    };

    const addCategory = () => {
        setPurchaseCategories((current) => [...current, ""]);
    };

    const removeCategory = (index: number) => {
        setPurchaseCategories((current) => {
            if (current.length === 1) {
                return [""];
            }

            return current.filter((_, idx) => idx !== index);
        });
    };

    const saveSettings = async () => {
        if (!data?.id) {
            setErrorMessage("Не найден ID группы");
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const normalizedCategories = purchaseCategories
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        try {
            const response = await fetch(`/admin/customer-groups/${data.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    metadata: {
                        ...metadata,
                        [RULES_TEXT_KEY]: rulesText.trim(),
                        [PURCHASE_CATEGORIES_KEY]: normalizedCategories,
                        [GROUP_TYPE_KEY]: groupType,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Save failed: ${response.status}`);
            }

            setSuccessMessage("Настройки сохранены");
        } catch (error) {
            setErrorMessage("Не удалось сохранить настройки");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">Настройки группы</Heading>
            </div>

            <div className="flex flex-col gap-6 px-6 py-4">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="group-type">Тип группы</Label>
                            <Select
                                value={groupType}
                                onValueChange={(value) =>
                                    setGroupType(
                                        value as "default" | "discount",
                                    )
                                }
                            >
                                <Select.Trigger id="group-type">
                                    <Select.Value />
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Item value="default">
                                        Обычная
                                    </Select.Item>
                                    <Select.Item value="discount">
                                        Скидочная
                                    </Select.Item>
                                </Select.Content>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Категории закупки</Label>
                            <div className="flex flex-col gap-2">
                                {purchaseCategories.map((category, index) => (
                                    <div
                                        className="flex items-center gap-2"
                                        key={`purchase-category-${index}`}
                                    >
                                        <Input
                                            value={category}
                                            onChange={(e) =>
                                                onChangeCategory(
                                                    index,
                                                    e.target.value,
                                                )
                                            }
                                            className="min-w-60"
                                            placeholder="Например: Т0"
                                        />
                                        <Button
                                            variant="secondary"
                                            type="button"
                                            onClick={() =>
                                                removeCategory(index)
                                            }
                                        >
                                            Удалить
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <Button
                                    variant="transparent"
                                    type="button"
                                    onClick={addCategory}
                                >
                                    Добавить категорию
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="group-rules-text">Условия работы</Label>
                        <Textarea
                            id="group-rules-text"
                            rows={12}
                            value={rulesText}
                            onChange={(e) => setRulesText(e.target.value)}
                            placeholder="Введите текст условий работы для этой группы"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <Button
                        type="button"
                        isLoading={isSaving}
                        onClick={saveSettings}
                    >
                        Сохранить
                    </Button>
                    {errorMessage ? (
                        <Text className="text-ui-fg-error">{errorMessage}</Text>
                    ) : null}
                    {successMessage ? (
                        <Text className="text-ui-fg-success">
                            {successMessage}
                        </Text>
                    ) : null}
                </div>
            </div>
        </Container>
    );
};

export const config = defineWidgetConfig({
    zone: "customer_group.details.after",
});

export default CustomerGroupWidget;
