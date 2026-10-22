"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type CategoryRow = {
  id: number;
  name: string;
};

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  stock_quantity: number;
  image_url: string | null;
  image_urls: unknown;
  video_url: string | null;
  category_id: number | null;
  is_active: boolean;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  image_urls: string[];
  video_url: string | null;
  category: string;
  emoji: string;
};

type CheckoutResponse = {
  success?: boolean;
  order_id?: number;
  order_number?: string;
  subtotal?: number | string;
  shipping_fee?: number | string;
  total?: number | string;
  error?: string;
};

type OrderRow = {
  id: number;
  order_number: string;
  status: string;
  total: number | string;
  payment_status: string;
  created_at: string;
};

const whatsappNumber = "923291311746";
const CART_STORAGE_KEY = "apna-mall-cart-v1";

const money = (amount: number) =>
  `Rs ${amount.toLocaleString("en-PK")}`;

function getProductImages(
  value: unknown,
  fallback: string | null
): string[] {
  let urls: unknown = value;

  if (typeof urls === "string") {
    try {
      urls = JSON.parse(urls);
    } catch {
      urls = [];
    }
  }

  const images = Array.isArray(urls)
    ? urls.filter(
        (url): url is string =>
          typeof url === "string" &&
          /^https?:\/\//i.test(url)
      )
    : [];

  const allImages = [
    ...(fallback ? [fallback] : []),
    ...images,
  ];

  return [...new Set(allImages)];
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Product details and gallery.
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [detailQuantity, setDetailQuantity] = useState(1);

  // Buy Now checks out only the selected product.
  const [buyNowItem, setBuyNowItem] = useState<{
    productId: number;
    quantity: number;
  } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [whatsappOrderUrl, setWhatsappOrderUrl] = useState("");
  const [lastOrderNumber, setLastOrderNumber] = useState("");
  const [lastOrderTotal, setLastOrderTotal] =
    useState<number | null>(null);

  // Customer authentication.
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] =
    useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  // Restore the cart from this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          const cleaned: Record<number, number> = {};

          for (const [id, quantity] of Object.entries(parsed)) {
            const numericId = Number(id);
            const numericQuantity = Number(quantity);

            if (
              Number.isSafeInteger(numericId) &&
              numericId > 0 &&
              Number.isSafeInteger(numericQuantity) &&
              numericQuantity > 0
            ) {
              cleaned[numericId] = numericQuantity;
            }
          }

          setCart(cleaned);
        }
      }
    } catch (error) {
      console.error("Could not load saved cart:", error);
    } finally {
      setCartLoaded(true);
    }
  }, []);

  // Save cart changes after restoring the saved cart.
  useEffect(() => {
    if (!cartLoaded) return;

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Could not save cart:", error);
    }
  }, [cart, cartLoaded]);

  // Load products, categories, images, and video URLs.
  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      setLoading(true);
      setLoadError("");

      try {
        const [categoryResult, productResult] = await Promise.all([
          supabase
            .from("categories")
            .select("id, name")
            .order("name"),

          supabase
            .from("products")
            .select(
              "id, name, slug, description, price, stock_quantity, image_url, image_urls, video_url, category_id, is_active"
            )
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

        if (categoryResult.error) throw categoryResult.error;
        if (productResult.error) throw productResult.error;

        const categoryRows =
          (categoryResult.data ?? []) as CategoryRow[];

        const productRows =
          (productResult.data ?? []) as ProductRow[];

        const categoryNames = new Map(
          categoryRows.map((item) => [item.id, item.name])
        );

        const loadedProducts: Product[] = productRows.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: Number(p.price),
          stock_quantity: Number(p.stock_quantity),
          image_url: p.image_url,
          image_urls: getProductImages(p.image_urls, p.image_url),
          video_url: p.video_url,
          category: categoryNames.get(p.category_id ?? -1) ?? "Other",
          emoji: "🛍️",
        }));

        if (cancelled) return;

        setProducts(loadedProducts);
        setCategories([
          "All",
          ...categoryRows.map((item) => item.name),
        ]);

        // Remove unavailable products from the saved cart and
        // clamp quantities to the available stock.
        setCart((old) => {
          const next: Record<number, number> = {};

          for (const [id, quantity] of Object.entries(old)) {
            const product = loadedProducts.find(
              (item) => item.id === Number(id)
            );

            if (product && product.stock_quantity > 0) {
              next[product.id] = Math.min(
                quantity,
                product.stock_quantity
              );
            }
          }

          return next;
        });
      } catch (error) {
        console.error("Failed to load Apna Mall products:", error);

        if (!cancelled) {
          setLoadError(
            "We couldn't load products. Please check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStore();

    return () => {
      cancelled = true;
    };
  }, []);

  // Restore authentication and listen for login/logout events.
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Could not read session:", error.message);
      }

      const currentUser = data.session?.user ?? null;

      setUser(currentUser);
      setAuthEmail(currentUser?.email ?? "");
      setEmail((old) => old || currentUser?.email || "");
      setAuthLoading(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;

      setUser(currentUser);
      setAuthEmail(currentUser?.email ?? "");
      setAuthPassword("");
      setAuthMessage("");
      setEmail((old) => old || currentUser?.email || "");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "All" || p.category === category) &&
          `${p.name} ${p.category} ${p.description ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [products, search, category]
  );

  const cartItems = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] || 0) > 0)
        .map((p) => ({
          ...p,
          quantity: cart[p.id],
        })),
    [products, cart]
  );

  // Determine which items are being purchased.
  const checkoutItems = useMemo(() => {
    if (buyNowItem) {
      const product = products.find(
        (p) => p.id === buyNowItem.productId
      );

      if (!product || product.stock_quantity <= 0) return [];

      return [
        {
          ...product,
          quantity: Math.min(
            buyNowItem.quantity,
            product.stock_quantity
          ),
        },
      ];
    }

    return cartItems;
  }, [buyNowItem, products, cartItems]);

  const count = cartItems.reduce(
    (sum, p) => sum + p.quantity,
    0
  );

  const total = checkoutItems.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0
  );

  function clearOrderSuccess() {
    setWhatsappOrderUrl("");
    setLastOrderNumber("");
    setLastOrderTotal(null);
  }

  function changeQuantity(id: number, amount: number) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const nextQuantity = (cart[id] || 0) + amount;

    if (nextQuantity > product.stock_quantity) {
      alert("The requested quantity exceeds available stock.");
      return;
    }

    setCart((old) => {
      const next = { ...old };

      if (nextQuantity <= 0) {
        delete next[id];
      } else {
        next[id] = nextQuantity;
      }

      return next;
    });
  }

  function addProductQuantity(product: Product, quantity: number) {
    if (product.stock_quantity <= 0) {
      alert("This product is out of stock.");
      return false;
    }

    const currentQuantity = cart[product.id] || 0;

    if (currentQuantity + quantity > product.stock_quantity) {
      alert(
        `Only ${product.stock_quantity} unit(s) of ${product.name} are available. You already have ${currentQuantity} in your cart.`
      );
      return false;
    }

    setCart((old) => ({
      ...old,
      [product.id]: (old[product.id] || 0) + quantity,
    }));

    clearOrderSuccess();
    return true;
  }

  function addToCart(product: Product) {
    addProductQuantity(product, 1);
  }

  function startBuyNow(product: Product, quantity = 1) {
    if (product.stock_quantity <= 0) {
      alert("This product is out of stock.");
      return;
    }

    clearOrderSuccess();

    // This does not add anything to the saved cart.
    setBuyNowItem({
      productId: product.id,
      quantity: Math.min(quantity, product.stock_quantity),
    });

    setCartOpen(true);
  }

  function removeCartItem(id: number) {
    setCart((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  }

  function openProductDetails(product: Product) {
    setSelectedProduct(product);
    setSelectedImageIndex(0);
    setDetailQuantity(1);
  }

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      return;
    }

    setOrdersLoading(true);
    setOrdersError("");

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, total, payment_status, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders((data ?? []) as OrderRow[]);
    } catch (error) {
      console.error("Could not load order history:", error);

      setOrdersError(
        "Could not load orders. Please check your order-history permissions."
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && accountOpen) {
      void loadOrders();
    }
  }, [user, accountOpen, loadOrders]);

  async function saveProfile(
    profileUser: User,
    profileName: string,
    profileEmail: string,
    profilePhone: string,
    profileCity: string,
    profileAddress: string
  ) {
    const { error } = await supabase
      .from("customer_profiles")
      .upsert(
        {
          user_id: profileUser.id,
          full_name: profileName.trim() || null,
          email: profileEmail.trim() || profileUser.email || null,
          mobile: profilePhone.trim() || null,
          city: profileCity.trim() || null,
          address: profileAddress.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
  }

  async function signInWithEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        setAuthMessage("You are signed in.");
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Sign-in failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function signUpWithEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: {
            full_name: authName.trim(),
          },
        },
      });

      if (error) throw error;

      if (data.user && data.session) {
        setUser(data.user);

        await saveProfile(
          data.user,
          authName,
          data.user.email ?? authEmail,
          "",
          "",
          ""
        );

        setAuthMessage("Your account has been created.");
      } else {
        setAuthMessage(
          "Account created. Check your email for the confirmation link."
        );
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "Account creation failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function signInWithGoogle() {
    setAuthBusy(true);
    setAuthMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "Google sign-in could not start."
      );

      setAuthBusy(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    setUser(null);
    setOrders([]);
    setAccountOpen(false);
  }

  async function updateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setProfileBusy(true);

    try {
      await saveProfile(
        user,
        name,
        email || user.email || "",
        phone,
        city,
        address
      );

      alert("Profile details saved.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save your profile."
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function sendOrder() {
    if (isSubmitting || whatsappOrderUrl) return;

    if (!checkoutItems.length) {
      alert(
        buyNowItem
          ? "The selected product is unavailable."
          : "Please add a product to your cart first."
      );
      return;
    }

    if (
      !name.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !city.trim() ||
      !address.trim()
    ) {
      alert(
        "Please enter your name, email, phone number, city, and delivery address."
      );
      return;
    }

    for (const item of checkoutItems) {
      if (
        item.quantity <= 0 ||
        item.quantity > item.stock_quantity
      ) {
        alert(`${item.name} does not have enough stock.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const accessToken = sessionData.session?.access_token;

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const orderItems = checkoutItems.map((p) => ({
        product_id: String(p.id),
        quantity: Number(p.quantity),
      }));

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          full_name: name.trim(),
          mobile: phone.trim(),
          email: user?.email || email.trim(),
          city: city.trim(),
          address: address.trim(),
          items: orderItems,
        }),
      });

      const result = (await response.json()) as CheckoutResponse;

      if (
        !response.ok ||
        result.success !== true ||
        !result.order_number
      ) {
        alert(
          result.error ||
            "We couldn't save your order. Please check your cart and try again."
        );
        return;
      }

      const savedSubtotal =
        result.subtotal !== undefined
          ? Number(result.subtotal)
          : total;

      const shippingFee =
        result.shipping_fee !== undefined
          ? Number(result.shipping_fee)
          : 0;

      const savedTotal =
        result.total !== undefined
          ? Number(result.total)
          : savedSubtotal + shippingFee;

      const message = [
        "APNA MALL PAKISTAN — ORDER",
        "",
        `Order number: ${result.order_number}`,
        `Customer: ${name.trim()}`,
        `Email: ${user?.email || email.trim()}`,
        `Mobile/WhatsApp: ${phone.trim()}`,
        `City: ${city.trim()}`,
        `Delivery address: ${address.trim()}`,
        "",
        "ITEMS:",
        ...checkoutItems.map(
          (p, i) =>
            `${i + 1}. ${p.name} | Qty: ${p.quantity} | Unit: ${money(p.price)} | Total: ${money(p.price * p.quantity)}`
        ),
        "",
        `Subtotal: ${money(savedSubtotal)}`,
        `Shipping: ${money(shippingFee)}`,
        `ORDER TOTAL: ${money(savedTotal)}`,
        "",
        "My order has been saved. Please confirm delivery details and payment instructions.",
      ].join("\n");

      const whatsappUrl =
        `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

      if (whatsappUrl.length > 7000) {
        alert(
          `Order ${result.order_number} was saved, but its WhatsApp message is too long. Please contact the store directly.`
        );
        return;
      }

      setLastOrderNumber(result.order_number);
      setLastOrderTotal(savedTotal);
      setWhatsappOrderUrl(whatsappUrl);

      // A normal cart order clears the cart.
      // Buy Now leaves the saved cart untouched.
      if (!buyNowItem) {
        setCart({});
      }

      setBuyNowItem(null);
      setName("");
      setPhone("");
      setEmail("");
      setCity("");
      setAddress("");

      if (user) {
        void loadOrders();
      }
    } catch (error) {
      console.error("Checkout request failed:", error);

      alert(
        error instanceof Error
          ? `Checkout failed: ${error.message}`
          : "Could not contact the checkout server. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetCheckoutSuccess() {
    clearOrderSuccess();
    setBuyNowItem(null);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#17251d]">
      <div className="bg-[#075b3b] px-4 py-2 text-center text-sm text-white">
        Apna Mall Pakistan · Quality Products · Great Prices
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#e1e8df] bg-[#fffdf5] shadow-sm">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <a
              href="#"
              className="shrink-0 text-xl font-black leading-tight text-[#075b3b] sm:text-2xl"
            >
              Apna <span className="text-[#e6a000]">Mall</span>
              <span className="mt-1 block text-center text-[9px] tracking-[4px]">
                PAKISTAN
              </span>
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(true);
                  setAuthMessage("");
                }}
                className="rounded-lg border border-[#075b3b] px-2 py-2 text-xs font-bold text-[#075b3b] sm:px-4 sm:py-3 sm:text-sm"
              >
                {authLoading
                  ? "Account..."
                  : user
                    ? "My Account"
                    : "Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setBuyNowItem(null);
                  clearOrderSuccess();
                  setCartOpen(true);
                }}
                className="whitespace-nowrap rounded-lg bg-[#075b3b] px-3 py-2 text-xs font-bold text-white sm:px-4 sm:py-3 sm:text-sm"
              >
                🛒 Cart ({count})
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-3 text-base outline-none transition focus:border-[#075b3b] focus:ring-2 focus:ring-[#075b3b]/15"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="bg-gradient-to-r from-[#e5f1e4] to-[#fff5d9]">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-16 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="font-bold uppercase tracking-[3px] text-[#08784b]">
              Welcome to Apna Mall
            </p>

            <h1 className="mt-3 text-5xl font-black leading-tight text-[#075b3b] md:text-6xl">
              Better Products.
              <br />
              <span className="text-[#e6a000]">
                Brighter Living.
              </span>
            </h1>

            <p className="mt-5 max-w-xl leading-7 text-gray-700">
              Shop useful gadgets, fashion accessories, and home
              essentials. Browse detailed product information, save
              your cart, and place your order through WhatsApp.
            </p>

            <a
              href="#products"
              className="mt-7 inline-block rounded-lg bg-[#075b3b] px-6 py-3 font-bold text-white"
            >
              Shop Products ↓
            </a>
          </div>

          <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-white bg-white/80 p-8 shadow-sm">
            <span className="text-8xl">🛍️</span>
            <p className="mt-5 text-center font-bold tracking-widest text-[#075b3b]">
              QUALITY · VALUE · CONVENIENCE
            </p>
          </div>
        </div>
      </section>

      {/* Store benefits */}
      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-5 py-6 md:grid-cols-4">
        {[
          ["🛡️", "Customer Care"],
          ["🚚", "Delivery Options"],
          ["🏷️", "Great Prices"],
          ["💬", "WhatsApp Orders"],
        ].map(([emoji, label]) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-4 text-center font-bold text-[#075b3b]"
          >
            <span className="block text-2xl">{emoji}</span>
            {label}
          </div>
        ))}
      </section>

      {/* Product listing */}
      <section id="products" className="mx-auto max-w-7xl px-5 pb-20">
        <h2 className="text-3xl font-black text-[#075b3b]">
          Featured Products
        </h2>

        <p className="mt-2 text-gray-600">
          Explore our products and open any item to see its details,
          pictures, and video.
        </p>

        <div className="my-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                category === c
                  ? "border-[#075b3b] bg-[#075b3b] text-white"
                  : "border-gray-200 bg-white"
              }`}
            >
              {c === "All" ? "All products" : c}
            </button>
          ))}
        </div>

        {loading && (
          <p className="rounded-xl bg-white p-8 text-center text-gray-600">
            Loading products from Apna Mall...
          </p>
        )}

        {!loading && loadError && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
            <p className="text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#075b3b] px-5 py-3 font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((p) => (
              <article
                key={p.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => openProductDetails(p)}
                  className="flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#edf5eb] to-[#fff5d9] sm:h-48"
                  aria-label={`View details for ${p.name}`}
                >
                  {p.image_urls.length > 0 ? (
                    <img
                      src={p.image_urls[0]}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-contain transition duration-300 hover:scale-105"
                    />
                  ) : (
                    <span className="text-6xl">{p.emoji}</span>
                  )}
                </button>

                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    {p.category}
                  </p>

                  <button
                    type="button"
                    onClick={() => openProductDetails(p)}
                    className="mt-2 min-h-10 text-left font-bold hover:text-[#08784b]"
                  >
                    {p.name}
                  </button>

                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                      {p.description}
                    </p>
                  )}

                  <p className="mt-3 text-lg font-black text-[#075b3b] sm:text-xl">
                    {money(p.price)}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {p.stock_quantity > 0
                      ? `${p.stock_quantity} available`
                      : "Out of stock"}
                  </p>

                  <div className="mt-auto space-y-2 pt-4">
                    <button
                      type="button"
                      onClick={() => openProductDetails(p)}
                      className="w-full rounded-lg border border-[#075b3b] px-2 py-2.5 text-sm font-bold text-[#075b3b] hover:bg-[#edf5eb]"
                    >
                      View Details
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={p.stock_quantity <= 0}
                        onClick={() => addToCart(p)}
                        className="rounded-lg border border-[#075b3b] px-2 py-3 text-xs font-bold text-[#075b3b] hover:bg-[#edf5eb] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                      >
                        Add to Cart
                      </button>

                      <button
                        type="button"
                        disabled={p.stock_quantity <= 0}
                        onClick={() => startBuyNow(p)}
                        className="rounded-lg bg-[#075b3b] px-2 py-3 text-xs font-bold text-white hover:bg-[#06472f] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {visibleProducts.length === 0 && (
              <p className="col-span-full rounded-xl bg-white p-8 text-center text-gray-500">
                No products found. Try another search.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-[#102f22] px-5 py-9 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6">
          <div>
            <h2 className="text-xl font-black">Apna Mall Pakistan</h2>
            <p className="mt-2 text-sm text-gray-300">
              Shop smart. Shop local.
            </p>
          </div>

          <div>
            <h3 className="font-bold">Contact us</h3>
            <p className="mt-2 text-sm text-gray-300">
              WhatsApp: +92 329 1311746
            </p>
            <p className="text-sm text-gray-300">
              apnamall6260@gmail.com
            </p>

            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block underline"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </footer>

      {/* Product details and media gallery */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-40 overflow-y-auto bg-black/60 p-3 sm:p-6"
          onClick={() => setSelectedProduct(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProduct.name} product details`}
            className="relative mx-auto my-4 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:my-8 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="font-bold text-[#075b3b]">
                Product Details
              </p>

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close product details"
                className="rounded-lg bg-gray-100 px-4 py-2 font-bold"
              >
                Close ✕
              </button>
            </div>

            <div className="grid gap-7 md:grid-cols-2">
              {/* Images and video */}
              <div className="min-w-0">
                <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#edf5eb] to-[#fff5d9] sm:min-h-96">
                  {selectedProduct.image_urls.length > 0 ? (
                    <img
                      src={
                        selectedProduct.image_urls[
                          Math.min(
                            selectedImageIndex,
                            selectedProduct.image_urls.length - 1
                          )
                        ]
                      }
                      alt={selectedProduct.name}
                      className="max-h-[480px] w-full object-contain"
                    />
                  ) : (
                    <span className="text-8xl">
                      {selectedProduct.emoji}
                    </span>
                  )}
                </div>

                {selectedProduct.image_urls.length > 1 && (
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                    {selectedProduct.image_urls.map((url, index) => (
                      <button
                        type="button"
                        key={`${url}-${index}`}
                        onClick={() => setSelectedImageIndex(index)}
                        aria-label={`View product image ${index + 1}`}
                        aria-pressed={selectedImageIndex === index}
                        className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                          selectedImageIndex === index
                            ? "border-[#075b3b]"
                            : "border-gray-200"
                        }`}
                      >
                        <img
                          src={url}
                          alt={`${selectedProduct.name} view ${index + 1}`}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {selectedProduct.video_url && (
                  <div className="mt-5">
                    <h3 className="mb-2 font-bold text-[#075b3b]">
                      Product Video
                    </h3>

                    <video
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-96 w-full rounded-xl bg-black"
                      src={selectedProduct.video_url}
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}
              </div>

              {/* Product information */}
              <div className="flex flex-col">
                <p className="text-sm font-bold uppercase tracking-wider text-[#08784b]">
                  {selectedProduct.category}
                </p>

                <h2 className="mt-2 break-words text-3xl font-black text-[#075b3b]">
                  {selectedProduct.name}
                </h2>

                <p className="mt-4 text-3xl font-black">
                  {money(selectedProduct.price)}
                </p>

                <p
                  className={`mt-3 text-sm font-semibold ${
                    selectedProduct.stock_quantity > 0
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {selectedProduct.stock_quantity > 0
                    ? `In stock — ${selectedProduct.stock_quantity} available`
                    : "Currently out of stock"}
                </p>

                <div className="my-5 border-t" />

                <h3 className="font-bold">Product Description</h3>

                <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-gray-600">
                  {selectedProduct.description?.trim() ||
                    "No detailed description is available for this product yet."}
                </p>

                <div className="mt-6">
                  <label className="block text-sm font-bold">
                    Quantity
                  </label>

                  <div className="mt-2 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setDetailQuantity((q) => Math.max(1, q - 1))
                      }
                      disabled={detailQuantity <= 1}
                      className="h-10 w-10 rounded-lg border font-bold disabled:opacity-40"
                    >
                      −
                    </button>

                    <span className="min-w-6 text-center font-bold">
                      {detailQuantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setDetailQuantity((q) =>
                          Math.min(
                            selectedProduct.stock_quantity,
                            q + 1
                          )
                        )
                      }
                      disabled={
                        detailQuantity >= selectedProduct.stock_quantity
                      }
                      className="h-10 w-10 rounded-lg border font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-[#f7f8f4] p-4">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-black text-[#075b3b]">
                    {money(
                      selectedProduct.price * detailQuantity
                    )}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={selectedProduct.stock_quantity <= 0}
                    onClick={() => {
                      const success = addProductQuantity(
                        selectedProduct,
                        detailQuantity
                      );

                      if (success) {
                        setSelectedProduct(null);
                      }
                    }}
                    className="rounded-lg border border-[#075b3b] px-4 py-3 font-bold text-[#075b3b] disabled:opacity-40"
                  >
                    Add to Cart
                  </button>

                  <button
                    type="button"
                    disabled={selectedProduct.stock_quantity <= 0}
                    onClick={() => {
                      const product = selectedProduct;
                      const quantity = detailQuantity;

                      setSelectedProduct(null);
                      startBuyNow(product, quantity);
                    }}
                    className="rounded-lg bg-[#075b3b] px-4 py-3 font-bold text-white disabled:opacity-40"
                  >
                    Buy Now
                  </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-gray-500">
                  Orders are processed through the existing Apna Mall
                  checkout and WhatsApp process.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Cart and checkout panel */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <button
            type="button"
            aria-label="Close cart overlay"
            className="absolute inset-0 cursor-default"
            onClick={() => setCartOpen(false)}
          />

          <aside className="relative h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-[#075b3b]">
                {buyNowItem ? "Buy Now" : "Your Cart"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setBuyNowItem(null);
                  setCartOpen(false);
                }}
                className="rounded-lg bg-gray-100 px-3 py-2"
              >
                Close ✕
              </button>
            </div>

            {buyNowItem && (
              <div className="mt-4 rounded-lg bg-[#fff5d9] p-3 text-sm">
                You are buying only the selected product. Your other cart
                items will remain saved.

                <button
                  type="button"
                  onClick={() => setBuyNowItem(null)}
                  className="mt-2 block font-bold text-[#075b3b] underline"
                >
                  Switch to full cart
                </button>
              </div>
            )}

            {!buyNowItem && (
              <p className="mt-3 text-sm text-gray-500">
                Your cart has {count} item{count === 1 ? "" : "s"}.
              </p>
            )}

            {checkoutItems.length === 0 ? (
              <p className="py-8 text-gray-500">
                {buyNowItem
                  ? "This product is unavailable."
                  : "Your cart is empty."}
              </p>
            ) : (
              <div className="my-5 space-y-4">
                {checkoutItems.map((p) => (
                  <div key={p.id} className="border-b pb-4">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f7f8f4]">
                            {p.image_urls.length > 0 ? (
                              <img
                                src={p.image_urls[0]}
                                alt={p.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-2xl">🛍️</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="break-words font-bold">
                              {p.name}
                            </p>

                            <p className="text-sm text-gray-500">
                              {money(p.price)} each
                            </p>

                            <p className="mt-1 font-semibold text-[#075b3b]">
                              {money(p.price * p.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (buyNowItem) {
                              setBuyNowItem((old) =>
                                old
                                  ? {
                                      ...old,
                                      quantity: Math.max(
                                        1,
                                        old.quantity - 1
                                      ),
                                    }
                                  : null
                              );
                            } else {
                              changeQuantity(p.id, -1);
                            }
                          }}
                          disabled={p.quantity <= 1}
                          className="rounded border px-2 disabled:opacity-40"
                        >
                          −
                        </button>

                        <span className="pt-1">{p.quantity}</span>

                        <button
                          type="button"
                          onClick={() => {
                            if (buyNowItem) {
                              if (p.quantity >= p.stock_quantity) {
                                alert(
                                  "You have reached the available stock."
                                );
                                return;
                              }

                              setBuyNowItem((old) =>
                                old
                                  ? {
                                      ...old,
                                      quantity: old.quantity + 1,
                                    }
                                  : null
                              );
                            } else {
                              changeQuantity(p.id, 1);
                            }
                          }}
                          disabled={p.quantity >= p.stock_quantity}
                          className="rounded border px-2 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (buyNowItem) {
                          setBuyNowItem(null);
                        } else {
                          removeCartItem(p.id);
                        }
                      }}
                      className="mt-3 text-sm font-semibold text-red-600 underline"
                    >
                      Remove item
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between border-t py-4 text-xl font-black">
              <span>
                {whatsappOrderUrl
                  ? "Saved order total"
                  : buyNowItem
                    ? "Selected total"
                    : "Cart total"}
              </span>

              <span>
                {money(
                  whatsappOrderUrl && lastOrderTotal !== null
                    ? lastOrderTotal
                    : total
                )}
              </span>
            </div>

            {whatsappOrderUrl ? (
              <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
                <div className="text-center">
                  <p className="text-2xl">✅</p>

                  <h3 className="mt-2 text-lg font-black text-[#075b3b]">
                    Order Saved Successfully!
                  </h3>

                  <p className="mt-2 text-sm text-gray-700">
                    Order number: <strong>{lastOrderNumber}</strong>
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    Tap below to open WhatsApp and send your order to
                    Apna Mall.
                  </p>
                </div>

                <a
                  href={whatsappOrderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-[#168b4e] p-4 text-center font-black text-white"
                >
                  Continue to WhatsApp →
                </a>

                <p className="text-center text-xs leading-5 text-gray-600">
                  You must press Send in WhatsApp to send the message.
                </p>

                <button
                  type="button"
                  onClick={resetCheckoutSuccess}
                  className="w-full rounded-lg border border-gray-300 p-3 font-bold text-gray-700"
                >
                  Place Another Order
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendOrder();
                }}
                className="space-y-4"
              >
                <label className="block text-sm font-semibold">
                  Full name *
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="mt-1 w-full rounded-lg border p-3 font-normal"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Email address *
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-lg border p-3 font-normal"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Mobile / WhatsApp number *
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="03xx xxxxxxx"
                    className="mt-1 w-full rounded-lg border p-3 font-normal"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  City *
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                    placeholder="Your city"
                    className="mt-1 w-full rounded-lg border p-3 font-normal"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Delivery address *
                  <textarea
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    placeholder="House number, street, area..."
                    className="mt-1 w-full rounded-lg border p-3 font-normal"
                    rows={3}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || checkoutItems.length === 0}
                  className="w-full rounded-lg bg-[#168b4e] p-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Saving Order..."
                    : buyNowItem
                      ? "Buy Selected Product & Continue"
                      : "Place Cart Order & Continue to WhatsApp"}
                </button>
              </form>
            )}

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Your order is saved before WhatsApp opens. You must press
              Send in WhatsApp to contact the store. Buy Now orders contain
              only the selected product. Your other cart items stay saved.
            </p>
          </aside>
        </div>
      )}

      {/* Customer account */}
      {accountOpen && (
        <div className="fixed inset-0 z-[60] flex justify-center overflow-y-auto bg-black/50 p-4">
          <button
            type="button"
            aria-label="Close account panel"
            className="fixed inset-0 cursor-default"
            onClick={() => setAccountOpen(false)}
          />

          <section className="relative my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-[#075b3b]">
                {user ? "My Account" : "Welcome to Apna Mall"}
              </h2>

              <button
                type="button"
                onClick={() => setAccountOpen(false)}
                className="rounded-lg bg-gray-100 px-3 py-2"
              >
                ✕
              </button>
            </div>

            {authLoading ? (
              <p className="py-8 text-gray-500">
                Checking your account...
              </p>
            ) : user ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-xl bg-[#edf5eb] p-4">
                  <p className="text-sm text-gray-600">Signed in as</p>
                  <p className="break-all font-bold">
                    {user.email || "Email not available"}
                  </p>
                </div>

                <form onSubmit={updateProfile} className="space-y-3">
                  <h3 className="font-bold text-[#075b3b]">
                    Your delivery profile
                  </h3>

                  <label className="block text-sm font-semibold">
                    Full name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    Email
                    <input
                      type="email"
                      value={email || user.email || ""}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    Mobile number
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    City
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    Delivery address
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={profileBusy}
                    className="w-full rounded-lg bg-[#075b3b] p-3 font-bold text-white disabled:opacity-50"
                  >
                    {profileBusy ? "Saving..." : "Save Profile"}
                  </button>
                </form>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-[#075b3b]">
                      My Orders
                    </h3>

                    <button
                      type="button"
                      onClick={() => void loadOrders()}
                      className="text-sm font-semibold underline"
                    >
                      Refresh
                    </button>
                  </div>

                  {ordersLoading && (
                    <p className="py-4 text-sm text-gray-500">
                      Loading your orders...
                    </p>
                  )}

                  {ordersError && (
                    <p className="py-4 text-sm text-red-700">
                      {ordersError}
                    </p>
                  )}

                  {!ordersLoading &&
                    !ordersError &&
                    orders.length === 0 && (
                      <p className="py-4 text-sm text-gray-500">
                        No orders are linked to this account yet.
                        Previous guest orders are not automatically linked.
                      </p>
                    )}

                  {!ordersLoading && orders.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {orders.map((order) => (
                        <article
                          key={order.id}
                          className="rounded-xl border p-4"
                        >
                          <div className="flex flex-wrap justify-between gap-2">
                            <p className="font-bold">
                              {order.order_number}
                            </p>

                            <span className="rounded-full bg-[#edf5eb] px-3 py-1 text-xs font-bold">
                              {order.status}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleString(
                              "en-PK"
                            )}
                          </p>

                          <div className="mt-3 flex justify-between gap-3">
                            <span className="text-sm text-gray-600">
                              Payment: {order.payment_status}
                            </span>

                            <span className="font-black text-[#075b3b]">
                              {money(Number(order.total))}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-full rounded-lg border border-red-200 p-3 font-bold text-red-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthMessage("");
                    }}
                    className={`rounded-lg p-3 font-bold ${
                      authMode === "login"
                        ? "bg-[#075b3b] text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthMessage("");
                    }}
                    className={`rounded-lg p-3 font-bold ${
                      authMode === "signup"
                        ? "bg-[#075b3b] text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <form
                  onSubmit={
                    authMode === "login"
                      ? signInWithEmail
                      : signUpWithEmail
                  }
                  className="mt-5 space-y-4"
                >
                  {authMode === "signup" && (
                    <label className="block text-sm font-semibold">
                      Full name
                      <input
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        autoComplete="name"
                        className="mt-1 w-full rounded-lg border p-3 font-normal"
                      />
                    </label>
                  )}

                  <label className="block text-sm font-semibold">
                    Email address
                    <input
                      required
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      autoComplete="email"
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    Password
                    <input
                      required
                      type="password"
                      minLength={6}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      autoComplete={
                        authMode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                      className="mt-1 w-full rounded-lg border p-3 font-normal"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full rounded-lg bg-[#075b3b] p-3 font-bold text-white disabled:opacity-50"
                  >
                    {authBusy
                      ? "Please wait..."
                      : authMode === "login"
                        ? "Login"
                        : "Create Account"}
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-500">OR</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={authBusy}
                  className="w-full rounded-lg border border-gray-300 p-3 font-bold disabled:opacity-50"
                >
                  Continue with Google
                </button>

                {authMessage && (
                  <p
                    role="status"
                    className="mt-4 rounded-lg bg-[#f7f8f4] p-3 text-sm"
                  >
                    {authMessage}
                  </p>
                )}

                <p className="mt-4 text-xs leading-5 text-gray-500">
                  You can place orders without creating an account.
                  Guest orders are saved but do not appear in account
                  order history.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
