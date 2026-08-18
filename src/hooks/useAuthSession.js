import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const USER_STORAGE_KEY = "homemap-user-v2";

export function mapSupabaseUser(authUser) {
  if (!authUser) return null;
  const firstName = authUser.user_metadata?.name || "";
  const lastName = authUser.user_metadata?.surname || authUser.user_metadata?.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    id: authUser.id,
    name: fullName || authUser.email?.split("@")[0] || "Usuario",
    email: authUser.email || "",
    avatar: authUser.user_metadata?.avatar_url || null,
  };
}

export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          console.error("Error loading Supabase session:", error);
        }
        setUser(mapSupabaseUser(data.session?.user));
      } catch (loadError) {
        console.error("Error loading Supabase session:", loadError);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (_event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
        }
        setUser(mapSupabaseUser(session?.user));
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  return { user, setUser, authLoading, passwordRecovery, setPasswordRecovery };
}
