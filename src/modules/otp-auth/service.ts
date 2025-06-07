import { AbstractAuthModuleProvider } from "@medusajs/framework/utils"
import {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse
} from "@medusajs/framework/types"
import { Logger } from "@medusajs/framework/types"
import EventBusService from "@medusajs/test-utils/dist/mock-event-bus-service"

type InjectedDependencies = {
  logger: Logger
}

type Options = {
  apiKey: string
}


class OTPAuthProvider extends AbstractAuthModuleProvider {
  static DISPLAY_NAME = "Basic OTP Auth"
  static identifier = "otp-auth"
  protected logger: Logger
  protected options: Options
  protected event_bus: EventBusService
  // assuming you're initializing a client

  constructor (
    container: InjectedDependencies,
    options: Options
  ) {
    super(...arguments)

    this.options = options
    this.logger = container.logger
    this.event_bus = container.event_bus

    // assuming you're initializing a client
  }

  async

  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const { phone } = data.body || {}

    if (!phone) {
      return {
        success: false,
        error: "Phone number is required",
      }
    }

    try {
      await authIdentityProviderService.retrieve({
        entity_id: phone,
      })
    } catch (error) {
      return {
        success: false,
        error: "User with phone number does not exist",
      }
    }

    const { hashedOTP, otp } = await this.generateOTP()

    await authIdentityProviderService.update(phone, {
      provider_metadata: {
        otp: hashedOTP,
      },
    })

    await this.event_bus.emit({
      name: "phone-auth.otp.generated",
      data: {
        otp,
        phone,
      },
    }, {})

    return {
      success: true,
      location: "otp",
    }
  }

  async generateOTP(): Promise<{ hashedOTP: string, otp: string }> {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // for debug
    this.logger.info(`Generated OTP: ${otp}`)
    
    const hashedOTP = jwt.sign({ otp }, this.options.jwtSecret, {
      expiresIn: "60s",
    })
    
    return { hashedOTP, otp }
  }

}

export default OTPAuthProvider
