import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext(null);

async function loadProfile(user) {
  const userId = user.id;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (data) return data;
  if (error) console.log("PROFILE LOAD ERROR:", error);

  // Fallback: the signup trigger didn't create a profile, so create a customer one.
  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      role: "customer",
      full_name: user.user_metadata?.full_name || user.email || "User",
    })
    .select()
    .maybeSingle();

  if (created) return created;
  if (createError) console.log("PROFILE CREATE ERROR:", createError);

  return { id: userId, role: "customer" };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckedSession(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (!newSession) setProfile(null);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    loadProfile(session.user).then((p) => {
      if (!cancelled) setProfile(p);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // "loading" stays true until we know both the session AND the role
  const loading = !checkedSession || (!!session && !profile);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error;
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    return { error, needsConfirmation: !error && !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // Re-reads the profile (e.g. after submitting an ID or checking approval status)
  async function refreshProfile() {
    if (!session?.user) return;
    const p = await loadProfile(session.user);
    setProfile(p);
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
