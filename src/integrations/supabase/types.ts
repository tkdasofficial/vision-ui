export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          target: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          target?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          target?: string
          title?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          capability: string | null
          created_at: string
          function_name: string
          id: string
          metadata: Json | null
          provider: string | null
          source: string | null
          status: string
          tokens: number | null
          user_id: string | null
        }
        Insert: {
          capability?: string | null
          created_at?: string
          function_name: string
          id?: string
          metadata?: Json | null
          provider?: string | null
          source?: string | null
          status?: string
          tokens?: number | null
          user_id?: string | null
        }
        Update: {
          capability?: string | null
          created_at?: string
          function_name?: string
          id?: string
          metadata?: Json | null
          provider?: string | null
          source?: string | null
          status?: string
          tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          level: string
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          level?: string
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          level?: string
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      background_tasks: {
        Row: {
          created_at: string
          error: string | null
          id: string
          input: Json
          progress: number
          result: Json | null
          session_id: string | null
          status: string
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          progress?: number
          result?: Json | null
          session_id?: string | null
          status?: string
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          progress?: number
          result?: Json | null
          session_id?: string | null
          status?: string
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          metadata: Json
          role: string
          session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          metadata?: Json
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          metadata?: Json
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          mode: string
          preview: string
          story_state: Json
          title: string
          tool_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          preview?: string
          story_state?: Json
          title?: string
          tool_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          preview?: string
          story_state?: Json
          title?: string
          tool_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          body: string
          campaign_id: string | null
          created_at: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          in_reply_to: string | null
          last_error: string | null
          lead_id: string
          scheduled_at: string
          sender_integration_id: string | null
          sent_at: string | null
          status: string
          step: number
          subject: string
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          attempts?: number
          body: string
          campaign_id?: string | null
          created_at?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          in_reply_to?: string | null
          last_error?: string | null
          lead_id: string
          scheduled_at?: string
          sender_integration_id?: string | null
          sent_at?: string | null
          status?: string
          step?: number
          subject: string
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          campaign_id?: string | null
          created_at?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          in_reply_to?: string | null
          last_error?: string | null
          lead_id?: string
          scheduled_at?: string
          sender_integration_id?: string | null
          sent_at?: string | null
          status?: string
          step?: number
          subject?: string
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_sender_integration_id_fkey"
            columns: ["sender_integration_id"]
            isOneToOne: false
            referencedRelation: "user_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          anchor_strategy: string
          body_tpl: string
          created_at: string
          id: string
          name: string
          subject_tpl: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_strategy?: string
          body_tpl: string
          created_at?: string
          id?: string
          name: string
          subject_tpl: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_strategy?: string
          body_tpl?: string
          created_at?: string
          id?: string
          name?: string
          subject_tpl?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          avg_views: number | null
          campaign_id: string | null
          channel_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_status: string
          id: string
          industry: string | null
          metadata: Json
          niche: string | null
          primary_domain: string | null
          prospecting_job_id: string | null
          source: string
          source_id: string | null
          status: string
          subscriber_count: number | null
          updated_at: string
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          avg_views?: number | null
          campaign_id?: string | null
          channel_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_status?: string
          id?: string
          industry?: string | null
          metadata?: Json
          niche?: string | null
          primary_domain?: string | null
          prospecting_job_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          subscriber_count?: number | null
          updated_at?: string
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          avg_views?: number | null
          campaign_id?: string | null
          channel_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_status?: string
          id?: string
          industry?: string | null
          metadata?: Json
          niche?: string | null
          primary_domain?: string | null
          prospecting_job_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          subscriber_count?: number | null
          updated_at?: string
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          provider: string
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          provider: string
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          provider?: string
          redirect_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_campaigns: {
        Row: {
          created_at: string
          daily_cap: number
          follow_up_enabled: boolean
          id: string
          name: string
          pitch_context: string
          status: string
          throttle_max_sec: number
          throttle_min_sec: number
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_cap?: number
          follow_up_enabled?: boolean
          id?: string
          name?: string
          pitch_context?: string
          status?: string
          throttle_max_sec?: number
          throttle_min_sec?: number
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_cap?: number
          follow_up_enabled?: boolean
          id?: string
          name?: string
          pitch_context?: string
          status?: string
          throttle_max_sec?: number
          throttle_min_sec?: number
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          features: Json
          limits: Json
          plan: string
          popular: boolean
          price_monthly: number
          price_yearly: number
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          features?: Json
          limits?: Json
          plan: string
          popular?: boolean
          price_monthly: number
          price_yearly: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          features?: Json
          limits?: Json
          plan?: string
          popular?: boolean
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      prospecting_jobs: {
        Row: {
          created_at: string
          error: string | null
          found_count: number
          id: string
          params: Json
          source: string
          status: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          found_count?: number
          id?: string
          params?: Json
          source: string
          status?: string
          target_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          found_count?: number
          id?: string
          params?: Json
          source?: string
          status?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reply_events: {
        Row: {
          created_at: string
          from_email: string | null
          gmail_message_id: string | null
          id: string
          lead_id: string | null
          sentiment: string | null
          snippet: string | null
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          created_at?: string
          from_email?: string | null
          gmail_message_id?: string | null
          id?: string
          lead_id?: string | null
          sentiment?: string | null
          snippet?: string | null
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          created_at?: string
          from_email?: string | null
          gmail_message_id?: string | null
          id?: string
          lead_id?: string | null
          sentiment?: string | null
          snippet?: string | null
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_events_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      story_projects: {
        Row: {
          analysis: Json
          audience: string | null
          audio_url: string | null
          category: string | null
          characters: Json
          created_at: string
          error: string | null
          generation_mode: string | null
          id: string
          language: string | null
          length: string | null
          progress: Json
          prompts: Json
          scenes: Json
          script: string | null
          session_id: string | null
          status: string
          title: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          audience?: string | null
          audio_url?: string | null
          category?: string | null
          characters?: Json
          created_at?: string
          error?: string | null
          generation_mode?: string | null
          id?: string
          language?: string | null
          length?: string | null
          progress?: Json
          prompts?: Json
          scenes?: Json
          script?: string | null
          session_id?: string | null
          status?: string
          title?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          audience?: string | null
          audio_url?: string | null
          category?: string | null
          characters?: Json
          created_at?: string
          error?: string | null
          generation_mode?: string | null
          id?: string
          language?: string | null
          length?: string | null
          progress?: Json
          prompts?: Json
          scenes?: Json
          script?: string | null
          session_id?: string | null
          status?: string
          title?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          priority: string
          replied_at: string | null
          replied_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_2fa: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          method?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          key_hint: string
          label: string
          last_validated_at: string | null
          metadata: Json
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          key_hint: string
          label?: string
          last_validated_at?: string | null
          metadata?: Json
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          key_hint?: string
          label?: string
          last_validated_at?: string | null
          metadata?: Json
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          access_token: string | null
          account_label: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          provider: string
          refresh_token: string | null
          scopes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_label?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider: string
          refresh_token?: string | null
          scopes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_label?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          scopes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_tool: string
          id: string
          language: string
          notifications_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_tool?: string
          id?: string
          language?: string
          notifications_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_tool?: string
          id?: string
          language?: string
          notifications_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          progress: Json
          status: string
          updated_at: string
          user_id: string
          workflow_tag: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          progress?: Json
          status?: string
          updated_at?: string
          user_id: string
          workflow_tag: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          progress?: Json
          status?: string
          updated_at?: string
          user_id?: string
          workflow_tag?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_use_own_keys: { Args: { _user_id: string }; Returns: boolean }
      check_2fa_by_email: { Args: { _email: string }; Returns: string }
      get_user_api_key: {
        Args: { _provider: string; _secret: string; _user_id: string }
        Returns: {
          id: string
          label: string
          metadata: Json
          plaintext: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      store_user_api_key: {
        Args: {
          _label: string
          _metadata: Json
          _plaintext: string
          _provider: string
          _secret: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
