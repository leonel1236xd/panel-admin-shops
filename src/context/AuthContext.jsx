import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSucursal, setUserSucursal] = useState(null);
  const [loading, setLoading] = useState(true);

  const INACTIVITY_LIMIT = 10 * 60 * 1000;

  useEffect(() => {
    const fetchUserRole = async (sessionUser) => {
      if (!sessionUser) return;

      const { data: empleado } = await supabase
        .from("empleados")
        .select("sucursal_id, rol")
        .eq("auth_id", sessionUser.id)
        .maybeSingle();

      if (empleado) {
        setUserRole("vendedor");
        setUserSucursal(empleado.sucursal_id);
      } else {
        setUserRole("admin");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      fetchUserRole(session?.user).then(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      await fetchUserRole(session?.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let timeoutId;
    const logoutUser = async () => {
      if (session) {
        console.log("Sesión cerrada por inactividad.");
        await supabase.auth.signOut();
      }
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (session) timeoutId = setTimeout(logoutUser, INACTIVITY_LIMIT);
    };

    const events = ["mousemove", "keydown", "wheel", "mousedown", "touchstart"];
    if (session) {
      resetTimer();
      events.forEach((event) => document.addEventListener(event, resetTimer));
    }

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => document.removeEventListener(event, resetTimer));
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, user, userRole, userSucursal, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);