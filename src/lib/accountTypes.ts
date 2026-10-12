export type AccountDetails = {
  user_id: string; legal_name: string; address_line1: string; address_line2: string;
  city: string; region: string; postal_code: string; country: string; date_of_birth: string;
  phone: string; social_handle: string; gender: string; avatar_path: string | null
}
export type AccountPreferences = {
  user_id: string; presence_status: 'online' | 'away' | 'busy' | 'offline';
  account_state: 'active' | 'frozen' | 'deletion_requested'; frozen_until: string | null;
  preferred_currency: string; location_sharing: boolean
}
export type NotificationPreferences = {
  rider_messages_in_app: boolean; rider_messages_email: boolean; rider_messages_sms: boolean;
  driver_messages_in_app: boolean; driver_messages_email: boolean; driver_messages_sms: boolean;
  browser_alerts: boolean; newsletter: boolean; updates: boolean; promotions: boolean; payment_reminders: boolean
}
export type AccountData = {
  email: string; profile: import('@/lib/supabase').Profile; details: AccountDetails;
  preferences: AccountPreferences; notifications: NotificationPreferences; avatarUrl: string | null;
  identity: { status: string; verified_at: string | null } | null;
  driverLicense: { status: string; license_expires_on: string | null } | null;
  driverIdentityCheck: { status: string; verified_at: string | null } | null;
  eligibility: { overall_status: string; registration_expires_on: string | null; insurance_expires_on: string | null; registration_status: string; insurance_status: string } | null
}
