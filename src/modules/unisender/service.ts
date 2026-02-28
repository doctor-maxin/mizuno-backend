import {
    AbstractNotificationProviderService,
    MedusaError,
} from "@medusajs/framework/utils";
import axios, { AxiosInstance } from "axios";
import {
    Logger,
    ProviderSendNotificationDTO,
    ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types";

type ServiceOptions = {
    url: string;
    apiKey: string;
    otpTemplate: string;
};

type InjectedDependencies = {
    logger: Logger;
};

class UnisenderNotificationService extends AbstractNotificationProviderService {
    static readonly identifier = "unisender";
    private readonly client: AxiosInstance;
    private readonly logger: Logger;
    private readonly options: ServiceOptions;

    constructor(container: InjectedDependencies, options: ServiceOptions) {
        super();

        this.options = options;
        this.logger = container.logger;
        this.client = axios.create({
            baseURL: options.url,
            headers: {
                "X-API-KEY": options.apiKey,
                "Content-Type": "application/json; charset=utf-8",
                Accept: "application/json",
            },
        });
    }

    static validateOptions(options: Record<any, any>): void | never {
        if (!options.apiKey) {
            throw new Error("API Key is required");
        }
        if (!options.otpTemplate) {
            throw new Error("OTP Template is required");
        }
        if (!options.url) {
            throw new Error("URL is required");
        }
    }

    async send(
        notification: ProviderSendNotificationDTO,
    ): Promise<ProviderSendNotificationResultsDTO> {
        const { data } = notification;

        if (notification.template !== "otp-template") {
            return {};
        }

        if (!data)
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                "Data is required",
            );

        const { data: result } = await this.client.post<
            | {
                  status: "success";
                  job_id: string;
                  emails: string[];
                  failed_emails: Record<string, string>;
              }
            | {
                  status: "error";
                  message: string;
                  code: string;
              }
        >("/email/send.json", {
            message: {
                recipients: [
                    {
                        email: notification.to,
                        substitutions: {
                            Name: "Уважаемый клиент",
                            AuthCode: data.otp,
                        },
                    },
                ],
                template_id: this.options.otpTemplate,
            },
        });

        if (result.status === "error") {
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                result.message,
            );
        }

        this.logger.info(
            `Email notification sent successfully to ${notification.to}`,
        );

        return {
            id: result.job_id.toString(),
        };
    }
}

export default UnisenderNotificationService;
