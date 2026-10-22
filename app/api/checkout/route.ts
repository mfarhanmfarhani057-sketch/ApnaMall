
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  const missing = [];

  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!secret) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  console.error("Checkout configuration missing:", missing);

  return NextResponse.json(
    {
      success: false,
      error: "Server configuration is missing.",
      missing,
    },
    { status: 500 }
  );
}

    const supabase = createClient(url, secret, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await request.json();

    const {
      full_name,
      mobile,
      email,
      city,
      address,
      province,
      postal_code,
      whatsapp,
      area,
      items,
    } = body;

    if (
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof mobile !== "string" ||
      !mobile.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof city !== "string" ||
      !city.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please complete your name, phone, email, city, address, and cart.",
        },
        { status: 400 }
      );
    }

    if (
      !items.every(
        (item: { product_id?: unknown; quantity?: unknown }) =>
          typeof item.product_id === "string" &&
          /^\d+$/.test(item.product_id) &&
          Number(item.product_id) > 0 &&
          Number.isSafeInteger(item.quantity) &&
          Number(item.quantity) > 0
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid product or quantity." },
        { status: 400 }
      );
    }

    // Guest checkout is allowed. If a token is provided,
    // verify it with Supabase before attaching the order to an account.
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : null;

    let verifiedUserId: string | null = null;
    let verifiedEmail: string | null = null;

    if (token) {
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        return NextResponse.json(
          { success: false, error: "Your session has expired. Please sign in again." },
          { status: 401 }
        );
      }

      verifiedUserId = data.user.id;
      verifiedEmail = data.user.email ?? null;
    }

    const orderEmail = verifiedEmail || email.trim();

    const { data, error } = await supabase.rpc("create_store_order", {
      p_payload: {
        full_name: full_name.trim(),
        mobile: mobile.trim(),
        email: orderEmail,
        city: city.trim(),
        address: address.trim(),
        province:
          typeof province === "string" ? province.trim() : null,
        postal_code:
          typeof postal_code === "string" ? postal_code.trim() : null,
        whatsapp:
          typeof whatsapp === "string" ? whatsapp.trim() : null,
        area: typeof area === "string" ? area.trim() : null,
        user_id: verifiedUserId,
        items: items.map(
          (item: { product_id: string; quantity: number }) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })
        ),
      },
    });

    if (error) {
      console.error("Checkout RPC error:", error.message);

      return NextResponse.json(
        {
          success: false,
          error: "Could not save your order. Please check your cart and try again.",
        },
        { status: 500 }
      );
    }

    if (!data || data.success !== true || !data.order_number) {
      return NextResponse.json(
        {
          success: false,
          error: data?.error || "The order was not confirmed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Checkout request error:", error);

    return NextResponse.json(
      { success: false, error: "An unexpected checkout error occurred." },
      { status: 500 }
    );
  }
}
