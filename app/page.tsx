"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
const CART_STORAGE_KEY = "Kamalia-Cart-cart-v1";

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
          typeof url === "string" && /^https?:\/\//i.test(url)
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
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [detailQuantity, setDetailQuantity] = useState(1);

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

  const searchResults = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return [];

    return products
      .filter((product) => {
        const searchableText = [
          product.name,
          product.category,
          product.slug,
          product.description ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .slice(0, 8);
  }, [products, search]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [search]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

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

  useEffect(() => {
    if (!cartLoaded) return;

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Could not save cart:", error);
    }
  }, [cart, cartLoaded]);

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

        const categoryRows = (categoryResult.data ?? []) as CategoryRow[];
        const productRows = (productResult.data ?? []) as ProductRow[];

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
        setCategories(["All", ...categoryRows.map((item) => item.name)]);

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
        console.error("Failed to load Kamalia Cart products:", error);

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

  const checkoutItems = useMemo(() => {
    if (buyNowItem) {
      const product = products.find(
        (p) => p.id === buyNowItem.productId
      );

      if (!product || product.stock_quantity <= 0) return [];

      return [
        {
          ...product,
          quantity: Math.min(buyNowItem.quantity, product.stock_quantity),
        },
      ];
    }

    return cartItems;
  }, [buyNowItem, products, cartItems]);

  const count = cartItems.reduce((sum, p) => sum + p.quantity, 0);

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

  useEffect(() => {
    const revealElements = document.querySelectorAll<HTMLElement>(
      ".reveal-animate"
    );

    if (!revealElements.length) return;

    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealElements.forEach((element) => {
        element.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            target.classList.add("is-visible");
          } else {
            target.classList.remove("is-visible");
          }
        });
      },
      {
        threshold: [0.15, 0.4],
        rootMargin: "0px 0px -8% 0px",
      }
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [products.length, category, loading, search, visibleProducts.length, selectedProduct]);

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
      if (item.quantity <= 0 || item.quantity > item.stock_quantity) {
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

      if (!response.ok || result.success !== true || !result.order_number) {
        alert(
          result.error ||
            "We couldn't save your order. Please check your cart and try again."
        );
        return;
      }

      const savedSubtotal =
        result.subtotal !== undefined ? Number(result.subtotal) : total;

      const shippingFee =
        result.shipping_fee !== undefined ? Number(result.shipping_fee) : 0;

      const savedTotal =
        result.total !== undefined ? Number(result.total) : savedSubtotal + shippingFee;

      const message = [
        "Kamalia Cart PAKISTAN — ORDER",
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
        "Delivery Charges: To be confirmed (delivery charges may apply depending on your location)",
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
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8f4] text-[#17251d]">
      <div className="bg-[#075b3b] px-4 py-2 text-center text-sm text-white">
        Kamalia Cart Pakistan · Quality Products · Great Prices
      </div>

      <header className="sticky top-0 z-20 border-b border-[#e1e8df] bg-[#fffdf5]/95 shadow-sm backdrop-blur-sm transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <a
              href="#"
              className="shrink-0 text-xl font-black leading-tight text-[#075b3b] sm:text-2xl"
            >
              Kamalia <span className="text-[#e6a000]">Cart</span>
              <span className="mt-1 block text-center text-[9px] tracking-[4px]">
                PAKISTAN
              </span>
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBuyNowItem(null);
                  clearOrderSuccess();
                  setCartOpen(true);
                }}
                className="whitespace-nowrap rounded-lg bg-[#075b3b] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#06472f] sm:px-4 sm:py-3 sm:text-sm"
              >
                🛒 Cart ({count})
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div ref={searchRef} className="relative z-30">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  🔍
                </span>

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchFocused(true);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={(event) => {
                    if (!searchResults.length) return;

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveSearchIndex((current) =>
                        Math.min(current + 1, searchResults.length - 1)
                      );
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveSearchIndex((current) =>
                        Math.max(current - 1, 0)
                      );
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();
                      const selectedProduct = searchResults[activeSearchIndex];

                      if (selectedProduct) {
                        openProductDetails(selectedProduct);
                        setSearchFocused(false);
                        setSearch("");
                      }
                    }

                    if (event.key === "Escape") {
                      setSearchFocused(false);
                    }
                  }}
                  placeholder="Search products..."
                  aria-label="Search products"
                  aria-expanded={searchFocused && search.trim().length > 0}
                  className="w-full rounded-2xl border border-[#dfe7df] bg-white py-3 pl-10 pr-3 text-base shadow-sm outline-none transition-all duration-300 focus:border-[#075b3b] focus:ring-2 focus:ring-[#075b3b]/15"
                />
              </div>

              {searchFocused && search.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-[#e6ece6] bg-white shadow-xl shadow-[#0a3a2d]/5">
                  {searchResults.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-2">
                      {searchResults.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            openProductDetails(product);
                            setSearchFocused(false);
                            setSearch("");
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ${
                            activeSearchIndex === index
                              ? "bg-[#edf5eb]"
                              : "hover:bg-[#f7f9f6]"
                          }`}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f5f7f2]">
                            {product.image_urls.length > 0 ? (
                              <img
                                src={product.image_urls[0]}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">🛍️</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#17251d]">
                              {product.name}
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-[#075b3b]">
                              {money(product.price)}
                            </p>
                          </div>

                          <div className="shrink-0 text-right text-[11px] font-medium text-gray-500">
                            {product.stock_quantity > 0
                              ? `${product.stock_quantity} available`
                              : "Out of stock"}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-sm text-gray-500">
                      No products found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-r from-[#e5f1e4] to-[#fff5d9]">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-16 md:grid-cols-[1.2fr_.8fr]">
          <div className="reveal-animate" data-direction="left" style={{ transitionDelay: "120ms" }}>
            <p className="font-bold uppercase tracking-[3px] text-[#08784b]">
              Welcome to Kamalia Cart
            </p>

            <h1 className="mt-3 text-5xl font-black leading-tight text-[#075b3b] md:text-6xl">
              Better Products.
              <br />
              <span className="text-[#e6a000]">Brighter Living.</span>
            </h1>

            <p className="mt-5 max-w-xl leading-7 text-gray-700">
              Shop useful gadgets, fashion accessories, and home essentials.
              Browse detailed product information, save your cart, and place
              your order through WhatsApp.
            </p>

            <a
              href="#products"
              className="reveal-animate mt-7 inline-block rounded-lg bg-[#075b3b] px-6 py-3 font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#06472f]"
              data-direction="up"
              style={{ transitionDelay: "220ms" }}
            >
              Shop Products ↓
            </a>
          </div>

          <div
            className="reveal-animate flex min-h-56 flex-col items-center justify-center rounded-3xl border border-white bg-white/80 p-8 shadow-sm"
            data-direction="right"
            style={{ transitionDelay: "180ms" }}
          >
            <span className="text-8xl">🛍️</span>
            <p className="mt-5 text-center font-bold tracking-widest text-[#075b3b]">
              QUALITY · VALUE · CONVENIENCE
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-5 py-6 md:grid-cols-4">
        {[
          ["🛡️", "Customer Care"],
          ["🚚", "Delivery Options"],
          ["🏷️", "Great Prices"],
          ["💬", "WhatsApp Orders"],
        ].map(([emoji, label], index) => (
          <div
            key={label}
            className="reveal-animate rounded-xl border border-[#edf0ea] bg-white p-4 text-center font-bold text-[#075b3b] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            data-direction={index % 2 === 0 ? "left" : "right"}
            style={{ transitionDelay: `${140 + index * 80}ms` }}
          >
            <span className="block text-2xl">{emoji}</span>
            {label}
          </div>
        ))}
      </section>

      <section id="products" className="mx-auto max-w-7xl px-5 pb-20">
        <h2
          className="reveal-animate text-3xl font-black text-[#075b3b]"
          data-direction="up"
        >
          Featured Products
        </h2>

        <p
          className="reveal-animate mt-2 text-gray-600"
          data-direction="up"
          style={{ transitionDelay: "80ms" }}
        >
          Explore our products and open any item to see its details, pictures,
          and video.
        </p>

        <div className="my-6 flex flex-wrap gap-2">
          {categories.map((c, index) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={`reveal-animate rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                category === c
                  ? "border-[#075b3b] bg-[#075b3b] text-white shadow-sm"
                  : "border-gray-200 bg-white hover:border-[#b8d5bf] hover:bg-[#f3f8f3]"
              }`}
              data-direction={index % 2 === 0 ? "left" : "right"}
              style={{ transitionDelay: `${120 + index * 40}ms` }}
            >
              {c === "All" ? "All products" : c}
            </button>
          ))}
        </div>

        {loading && (
          <p className="rounded-xl bg-white p-8 text-center text-gray-600">
            Loading products from Kamalia Cart...
          </p>
        )}

        {!loading && loadError && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
            <p className="text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#075b3b] px-5 py-3 font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#06472f]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((p, index) => (
              <article
                key={p.id}
                className="reveal-animate group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-400 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(7,91,59,0.12)]"
                data-direction={
                  index % 3 === 0 ? "left" : index % 3 === 1 ? "right" : "up"
                }
                style={{ transitionDelay: `${index * 70}ms` }}
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
                      className="product-image h-full w-full object-contain transition-transform duration-400 group-hover:scale-105"
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
                    className="mt-2 min-h-10 text-left font-bold text-[#17251d] transition-colors duration-200 hover:text-[#08784b]"
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
                      className="w-full rounded-lg border border-[#075b3b] px-2 py-2.5 text-sm font-bold text-[#075b3b] transition-all duration-300 hover:bg-[#edf5eb]"
                    >
                      View Details
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={p.stock_quantity <= 0}
                        onClick={() => addToCart(p)}
                        className="rounded-lg border border-[#075b3b] px-2 py-3 text-xs font-bold text-[#075b3b] transition-all duration-300 hover:bg-[#edf5eb] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                      >
                        Add to Cart
                      </button>

                      <button
                        type="button"
                        disabled={p.stock_quantity <= 0}
                        onClick={() => startBuyNow(p)}
                        className="rounded-lg bg-[#075b3b] px-2 py-3 text-xs font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#06472f] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
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
                No products found.
              </p>
            )}
          </div>
        )}
      </section>

      <footer className="bg-[#102f22] px-5 py-9 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6">
          <div>
            <h2 className="text-xl font-black">Kamalia Cart Pakistan</h2>
            <p className="mt-2 text-sm text-gray-300">Shop smart. Shop local.</p>
          </div>

          <div>
            <h3 className="font-bold">Contact us</h3>
            <p className="mt-2 text-sm text-gray-300">
              WhatsApp: +92 329 1311746
            </p>
            <p className="text-sm text-gray-300">kamaliacart@gmail.com</p>

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

      {selectedProduct && (
        <div
          className="fixed inset-0 z-40 overflow-y-auto bg-black/60 p-3 sm:p-6"
          onClick={() => setSelectedProduct(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProduct.name} product details`}
            className="reveal-animate relative mx-auto my-4 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:my-8 sm:p-7"
            data-direction="up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="font-bold text-[#075b3b]">Product Details</p>

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
              <div className="min-w-0">
                <div className="reveal-animate flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#edf5eb] to-[#fff5d9] sm:min-h-96" data-direction="left" style={{ transitionDelay: "80ms" }}>
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
                    <span className="text-8xl">{selectedProduct.emoji}</span>
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
                  <div className="reveal-animate mt-5" data-direction="up" style={{ transitionDelay: "140ms" }}>
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

              <div className="flex flex-col">
                <p className="reveal-animate text-sm font-bold uppercase tracking-wider text-[#08784b]" data-direction="up" style={{ transitionDelay: "110ms" }}>
                  {selectedProduct.category}
                </p>

                <h2 className="reveal-animate mt-2 break-words text-3xl font-black text-[#075b3b]" data-direction="up" style={{ transitionDelay: "150ms" }}>
                  {selectedProduct.name}
                </h2>

                <p className="reveal-animate mt-4 text-3xl font-black" data-direction="up" style={{ transitionDelay: "190ms" }}>{money(selectedProduct.price)}</p>

                <p
                  className={`reveal-animate mt-3 text-sm font-semibold ${
                    selectedProduct.stock_quantity > 0
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                  data-direction="up"
                  style={{ transitionDelay: "220ms" }}
                >
                  {selectedProduct.stock_quantity > 0
                    ? `In stock — ${selectedProduct.stock_quantity} available`
                    : "Currently out of stock"}
                </p>

                <div className="reveal-animate my-5 border-t" data-direction="up" style={{ transitionDelay: "240ms" }} />

                <h3 className="reveal-animate font-bold" data-direction="up" style={{ transitionDelay: "260ms" }}>Product Description</h3>

                <p className="reveal-animate mt-2 whitespace-pre-wrap break-words leading-7 text-gray-600" data-direction="up" style={{ transitionDelay: "300ms" }}>
                  {selectedProduct.description?.trim() ||
                    "No detailed description is available for this product yet."}
                </p>

                <div className="reveal-animate mt-6" data-direction="up" style={{ transitionDelay: "330ms" }}>
                  <label className="block text-sm font-bold">Quantity</label>

                  <div className="mt-2 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setDetailQuantity((q) => Math.max(1, q - 1))}
                      disabled={detailQuantity <= 1}
                      className="h-10 w-10 rounded-lg border font-bold disabled:opacity-40"
                    >
                      −
                    </button>

                    <span className="min-w-6 text-center font-bold">{detailQuantity}</span>

                    <button
                      type="button"
                      onClick={() =>
                        setDetailQuantity((q) =>
                          Math.min(selectedProduct.stock_quantity, q + 1)
                        )
                      }
                      disabled={detailQuantity >= selectedProduct.stock_quantity}
                      className="h-10 w-10 rounded-lg border font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="reveal-animate mt-5 flex items-center justify-between gap-3 rounded-xl bg-[#f7f8f4] p-4" data-direction="up" style={{ transitionDelay: "360ms" }}>
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-black text-[#075b3b]">
                    {money(selectedProduct.price * detailQuantity)}
                  </span>
                </div>

                <div className="reveal-animate mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2" data-direction="up" style={{ transitionDelay: "390ms" }}>
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

                <p className="reveal-animate mt-4 text-xs leading-5 text-gray-500" data-direction="up" style={{ transitionDelay: "420ms" }}>
                  Orders are processed through the existing Kamalia Cart checkout
                  and WhatsApp process.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

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
                You are buying only the selected product. Your other cart items
                will remain saved.

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
                {buyNowItem ? "This product is unavailable." : "Your cart is empty."}
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
                            <p className="break-words font-bold">{p.name}</p>

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
                                      quantity: Math.max(1, old.quantity - 1),
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
                                alert("You have reached the available stock.");
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
                  whatsappOrderUrl && lastOrderTotal !== null ? lastOrderTotal : total
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
                    Tap below to open WhatsApp and send your order to Kamalia Cart.
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
              Your order is saved before WhatsApp opens. You must press Send in
              WhatsApp to contact the store. Buy Now orders contain only the
              selected product. Your other cart items stay saved.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
