import { container } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";

export default async function sendOtpHandler({
    event,
}: SubscriberArgs<{ email: string; otp: string }>) {
    const notificationModuleService = container.resolve(Modules.NOTIFICATION);

    await notificationModuleService.createNotifications({
        to: event.data.email,
        channel: "email",
        template: "otp-template",
        data: event.data,
    });
}

export const config: SubscriberConfig = {
    event: "email-auth.otp.generated",
};
