import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (req, ctx) => {
      try {
        const body = await req.json();

        const {
          nombre,
          apellido,
          email,
          password,
          rol,
          departamento_id,
          activo,
        } = body;

        if (!nombre || !apellido || !email || !password) {
          return Response.json(
            {
              error:
                "Nombre, apellido, correo y contraseña son obligatorios.",
            },
            { status: 400 }
          );
        }

        if (!ctx.supabaseAdmin) {
          return Response.json(
            {
              error: "No se pudo obtener el cliente administrativo.",
            },
            { status: 500 }
          );
        }

        const { data: authData, error: authError } =
          await ctx.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

        if (authError) {
          console.error("Error creando usuario Auth:", authError);

          return Response.json(
            {
              error: authError.message,
            },
            { status: 400 }
          );
        }

        const authUser = authData.user;

        if (!authUser) {
          return Response.json(
            {
              error: "No se pudo crear el usuario de autenticación.",
            },
            { status: 500 }
          );
        }

        const { data: usuario, error: usuarioError } =
          await ctx.supabaseAdmin
            .from("usuarios")
            .insert({
              nombre,
              apellido,
              email,
              rol: rol || "usuario",
              departamento_id: departamento_id || null,
              activo: activo ?? true,
              auth_user_id: authUser.id,
            })
            .select()
            .single();

        if (usuarioError) {
          console.error("Error creando perfil:", usuarioError);

          await ctx.supabaseAdmin.auth.admin.deleteUser(authUser.id);

          return Response.json(
            {
              error: "No se pudo crear el perfil del usuario.",
              detalle: usuarioError.message,
            },
            { status: 400 }
          );
        }

        return Response.json({
          success: true,
          message: "Usuario creado correctamente.",
          usuario,
        });
      } catch (error) {
        console.error("Error inesperado:", error);

        return Response.json(
          {
            error: "Ocurrió un error inesperado.",
          },
          { status: 500 }
        );
      }
    }
  ),
};