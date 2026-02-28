import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Container, Heading } from "@medusajs/ui";
import {
    DetailWidgetProps,
    AdminCustomerGroup,
} from "@medusajs/framework/types";

// The widget
const CustomerGroupWidget = ({
    data,
}: DetailWidgetProps<AdminCustomerGroup>) => {
    return (
        <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">Настройки группы:</Heading>
            </div>
        </Container>
    );
};

// The widget's configurations
export const config = defineWidgetConfig({
    zone: "customer_group.details.after",
});

export default CustomerGroupWidget;
