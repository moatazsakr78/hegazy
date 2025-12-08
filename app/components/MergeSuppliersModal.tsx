"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase/client";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  account_balance: number | null;
  category: string | null;
  is_active: boolean | null;
  group_id: string | null;
  opening_balance: number | null;
  created_at: string | null;
}

interface MergeStats {
  invoicesCount: number;
  paymentsCount: number;
  calculatedBalance: number;
}

interface MergeRecord {
  id: string;
  primary_supplier_id: string;
  merged_supplier_id: string;
  merged_at: string;
  can_undo_until: string;
  is_permanent: boolean;
  merged_supplier_data: any;
  moved_purchase_invoices_ids: string[];
  moved_payments_ids: string[];
  merged_account_balance: number;
  merged_opening_balance: number;
  primary_supplier?: {
    id: string;
    name: string;
    phone: string | null;
  };
}

interface MergeSuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete?: () => void;
  preSelectedSupplier?: Supplier | null;
}

export default function MergeSuppliersModal({
  isOpen,
  onClose,
  onMergeComplete,
  preSelectedSupplier,
}: MergeSuppliersModalProps) {
  // Tab: "merge" for merging, "pending" for pending merges
  const [activeTab, setActiveTab] = useState<"merge" | "pending">("merge");

  // Step 1: Select suppliers, Step 2: Confirm merge
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected suppliers
  const [supplierToMerge, setSupplierToMerge] = useState<Supplier | null>(null);
  const [primarySupplier, setPrimarySupplier] = useState<Supplier | null>(null);
  const [selectingFor, setSelectingFor] = useState<"merge" | "primary">("merge");

  // Merge stats
  const [mergeStats, setMergeStats] = useState<MergeStats | null>(null);
  const [primaryStats, setPrimaryStats] = useState<MergeStats | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState(false);

  // Calculated balances for supplier list display
  const [supplierBalances, setSupplierBalances] = useState<{[key: string]: number}>({});

  // Pending merges state
  const [pendingMerges, setPendingMerges] = useState<MergeRecord[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate balance for a single supplier
  const calculateSupplierBalance = async (supplierId: string): Promise<number> => {
    const [invoicesRes, paymentsRes] = await Promise.all([
      supabase.from("purchase_invoices").select("total_amount").eq("supplier_id", supplierId),
      supabase.from("supplier_payments").select("amount").eq("supplier_id", supplierId),
    ]);

    const totalInvoices = (invoicesRes.data || []).reduce((total, invoice) => {
      return total + (invoice.total_amount || 0);
    }, 0);

    const totalPayments = (paymentsRes.data || []).reduce((total, payment) => {
      return total + (payment.amount || 0);
    }, 0);

    // Balance = Invoices - Payments (what we owe the supplier)
    return totalInvoices - totalPayments;
  };

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (fetchError) {
        console.error("Error fetching suppliers:", fetchError);
        setError("فشل في تحميل الموردين");
        return;
      }

      setSuppliers(data || []);

      // Calculate balances for all suppliers
      if (data && data.length > 0) {
        const balances: {[key: string]: number} = {};

        await Promise.all(
          data.map(async (supplier) => {
            const balance = await calculateSupplierBalance(supplier.id);
            balances[supplier.id] = balance;
          })
        );

        setSupplierBalances(balances);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch merge statistics for a supplier
  const fetchSupplierStats = async (supplierId: string): Promise<MergeStats> => {
    const [invoicesRes, paymentsRes] = await Promise.all([
      supabase.from("purchase_invoices").select("id, total_amount").eq("supplier_id", supplierId),
      supabase.from("supplier_payments").select("id, amount").eq("supplier_id", supplierId),
    ]);

    const totalInvoices = (invoicesRes.data || []).reduce((total, invoice) => {
      return total + (invoice.total_amount || 0);
    }, 0);

    const totalPayments = (paymentsRes.data || []).reduce((total, payment) => {
      return total + (payment.amount || 0);
    }, 0);

    const calculatedBalance = totalInvoices - totalPayments;

    return {
      invoicesCount: invoicesRes.data?.length || 0,
      paymentsCount: paymentsRes.data?.length || 0,
      calculatedBalance: calculatedBalance,
    };
  };

  // Fetch pending merges
  const fetchPendingMerges = async () => {
    try {
      setPendingLoading(true);

      const { data, error: fetchError } = await (supabase as any)
        .from("supplier_merges")
        .select(`
          *,
          primary_supplier:suppliers!supplier_merges_primary_supplier_id_fkey(id, name, phone)
        `)
        .eq("is_permanent", false)
        .gt("can_undo_until", new Date().toISOString())
        .order("merged_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching merges:", fetchError);
        return;
      }

      setPendingMerges((data || []) as MergeRecord[]);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setPendingLoading(false);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (canUndoUntil: string): string => {
    const now = new Date();
    const deadline = new Date(canUndoUntil);
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return "انتهت المهلة";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} ساعة و ${minutes} دقيقة`;
    }
    return `${minutes} دقيقة`;
  };

  // Check if can still undo
  const canUndo = (canUndoUntil: string): boolean => {
    return new Date(canUndoUntil) > new Date();
  };

  // Undo merge
  const undoMerge = async (merge: MergeRecord) => {
    if (!canUndo(merge.can_undo_until)) {
      setError("انتهت مهلة فك الدمج");
      return;
    }

    setUndoingId(merge.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const mergedSupplierData = merge.merged_supplier_data;

      // 1. Reactivate merged supplier
      const { error: reactivateError } = await supabase
        .from("suppliers")
        .update({ is_active: true })
        .eq("id", merge.merged_supplier_id);

      if (reactivateError) {
        throw new Error("فشل في إعادة تفعيل الحساب: " + reactivateError.message);
      }

      // 2. Move purchase invoices back
      if (merge.moved_purchase_invoices_ids && merge.moved_purchase_invoices_ids.length > 0) {
        await supabase
          .from("purchase_invoices")
          .update({ supplier_id: merge.merged_supplier_id })
          .in("id", merge.moved_purchase_invoices_ids);
      }

      // 3. Move payments back
      if (merge.moved_payments_ids && merge.moved_payments_ids.length > 0) {
        await supabase
          .from("supplier_payments")
          .update({ supplier_id: merge.merged_supplier_id })
          .in("id", merge.moved_payments_ids);
      }

      // 4. Restore balance on primary supplier
      const { data: primarySupplierData } = await supabase
        .from("suppliers")
        .select("account_balance")
        .eq("id", merge.primary_supplier_id)
        .single();

      if (primarySupplierData) {
        const newBalance = (primarySupplierData.account_balance || 0) - merge.merged_account_balance;

        await supabase
          .from("suppliers")
          .update({
            account_balance: newBalance,
          })
          .eq("id", merge.primary_supplier_id);
      }

      // 5. Delete merge record
      await (supabase as any)
        .from("supplier_merges")
        .delete()
        .eq("id", merge.id);

      setSuccessMessage(`تم فك دمج حساب "${mergedSupplierData?.name}" بنجاح`);

      // Refresh list
      await fetchPendingMerges();

      // Notify parent
      if (onMergeComplete) {
        onMergeComplete();
      }

    } catch (err: any) {
      console.error("Undo error:", err);
      setError(err.message || "حدث خطأ أثناء فك الدمج");
    } finally {
      setUndoingId(null);
    }
  };

  // Reset modal state
  const resetModal = () => {
    setActiveTab("merge");
    setStep(1);
    setSearchQuery("");
    setSupplierToMerge(null);
    setPrimarySupplier(null);
    setSelectingFor("merge");
    setMergeStats(null);
    setPrimaryStats(null);
    setIsMerging(false);
    setMergeSuccess(false);
    setError(null);
    setSuccessMessage(null);
  };

  // Handle modal open
  useEffect(() => {
    if (isOpen) {
      resetModal();
      fetchSuppliers();
      fetchPendingMerges();
      if (preSelectedSupplier) {
        setSupplierToMerge(preSelectedSupplier);
      }
    }
  }, [isOpen, preSelectedSupplier]);

  // Fetch pending merges when tab changes to pending
  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingMerges();
    }
  }, [activeTab]);

  // Fetch stats when both suppliers are selected
  useEffect(() => {
    const fetchStats = async () => {
      if (supplierToMerge && primarySupplier) {
        const [mergeS, primaryS] = await Promise.all([
          fetchSupplierStats(supplierToMerge.id),
          fetchSupplierStats(primarySupplier.id),
        ]);
        setMergeStats(mergeS);
        setPrimaryStats(primaryS);
      }
    };
    fetchStats();
  }, [supplierToMerge, primarySupplier]);

  // Handle supplier selection
  const handleSelectSupplier = (supplier: Supplier) => {
    if (selectingFor === "merge") {
      if (primarySupplier?.id === supplier.id) {
        setError("لا يمكن اختيار نفس المورد للدمج");
        return;
      }
      setSupplierToMerge(supplier);
      setSelectingFor("primary");
    } else {
      if (supplierToMerge?.id === supplier.id) {
        setError("لا يمكن اختيار نفس المورد للدمج");
        return;
      }
      setPrimarySupplier(supplier);
    }
    setError(null);
  };

  // Swap suppliers
  const swapSuppliers = () => {
    const temp = supplierToMerge;
    setSupplierToMerge(primarySupplier);
    setPrimarySupplier(temp);
  };

  // Proceed to confirmation step
  const proceedToConfirm = () => {
    if (!supplierToMerge || !primarySupplier) {
      setError("يجب اختيار موردين للدمج");
      return;
    }
    setStep(2);
  };

  // Execute merge
  const executeMerge = async () => {
    if (!supplierToMerge || !primarySupplier) return;

    setIsMerging(true);
    setError(null);

    try {
      // 1. Get all records that will be moved
      const [invoicesRes, paymentsRes] = await Promise.all([
        supabase.from("purchase_invoices").select("id").eq("supplier_id", supplierToMerge.id),
        supabase.from("supplier_payments").select("id").eq("supplier_id", supplierToMerge.id),
      ]);

      const movedInvoicesIds = (invoicesRes.data || []).map(i => i.id);
      const movedPaymentsIds = (paymentsRes.data || []).map(p => p.id);

      // 2. Calculate new combined balance
      const newAccountBalance = (primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0);

      // 3. Create merge record
      const { data: mergeRecord, error: mergeError } = await (supabase as any)
        .from("supplier_merges")
        .insert({
          primary_supplier_id: primarySupplier.id,
          merged_supplier_id: supplierToMerge.id,
          merged_supplier_data: supplierToMerge,
          moved_purchase_invoices_ids: movedInvoicesIds,
          moved_payments_ids: movedPaymentsIds,
          merged_account_balance: mergeStats?.calculatedBalance || 0,
          merged_opening_balance: supplierToMerge.opening_balance || 0,
        })
        .select()
        .single();

      if (mergeError) {
        throw new Error("فشل في إنشاء سجل الدمج: " + mergeError.message);
      }

      // 4. Move all records to primary supplier
      const updatePromises = [];

      if (movedInvoicesIds.length > 0) {
        updatePromises.push(
          supabase
            .from("purchase_invoices")
            .update({ supplier_id: primarySupplier.id })
            .in("id", movedInvoicesIds)
        );
      }

      if (movedPaymentsIds.length > 0) {
        updatePromises.push(
          supabase
            .from("supplier_payments")
            .update({ supplier_id: primarySupplier.id })
            .in("id", movedPaymentsIds)
        );
      }

      // 5. Update primary supplier's balance
      updatePromises.push(
        supabase
          .from("suppliers")
          .update({
            account_balance: newAccountBalance,
          })
          .eq("id", primarySupplier.id)
      );

      // 6. Deactivate merged supplier
      updatePromises.push(
        supabase
          .from("suppliers")
          .update({ is_active: false })
          .eq("id", supplierToMerge.id)
      );

      // Execute all updates
      await Promise.all(updatePromises);

      setMergeSuccess(true);

      // Notify parent and close after delay
      setTimeout(() => {
        if (onMergeComplete) {
          onMergeComplete();
        }
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error("Merge error:", err);
      setError(err.message || "حدث خطأ أثناء عملية الدمج");
    } finally {
      setIsMerging(false);
    }
  };

  // Filter suppliers
  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      searchQuery === "" ||
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.phone && supplier.phone.includes(searchQuery)) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  // Check if supplier is default
  const isDefaultSupplier = (supplier: Supplier) => supplier.name === "مورد";

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-[#1F2937] shadow-xl transition-all border border-gray-600">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-600">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                    <ArrowsRightLeftIcon className="h-6 w-6 text-blue-400" />
                    دمج الموردين
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-600">
                  <button
                    onClick={() => { setActiveTab("merge"); setError(null); setSuccessMessage(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === "merge"
                        ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/10"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                    }`}
                  >
                    <ArrowsRightLeftIcon className="h-4 w-4" />
                    دمج موردين
                  </button>
                  <button
                    onClick={() => { setActiveTab("pending"); setError(null); setSuccessMessage(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === "pending"
                        ? "text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                    }`}
                  >
                    <ClockIcon className="h-4 w-4" />
                    الدمجات المعلقة
                    {pendingMerges.length > 0 && (
                      <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {pendingMerges.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Pending Merges Tab */}
                {activeTab === "pending" ? (
                  <div>
                    {/* Success Message */}
                    {successMessage && (
                      <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400">
                        <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{successMessage}</span>
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {/* Info Box */}
                    <div className="mx-6 mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <p className="text-sm text-yellow-400">
                        يمكنك فك الدمج واسترجاع حسابات الموردين المدمجة خلال 24 ساعة من وقت الدمج.
                        بعد انتهاء المهلة، يصبح الدمج نهائياً.
                      </p>
                    </div>

                    {/* Pending Merges List */}
                    <div className="p-6 max-h-[400px] overflow-y-auto scrollbar-hide">
                      {pendingLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                          <p className="text-gray-400">جاري التحميل...</p>
                        </div>
                      ) : pendingMerges.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <CheckCircleIcon className="h-16 w-16 text-green-500 mb-4" />
                          <p className="text-gray-400 text-lg mb-2">لا توجد دمجات معلقة</p>
                          <p className="text-gray-500 text-sm">جميع الدمجات السابقة أصبحت نهائية</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingMerges.map((merge) => {
                            const mergedData = merge.merged_supplier_data;
                            const stillCanUndo = canUndo(merge.can_undo_until);

                            return (
                              <div
                                key={merge.id}
                                className={`p-4 rounded-xl border ${
                                  stillCanUndo
                                    ? "bg-[#2B3544] border-gray-600"
                                    : "bg-gray-700/50 border-gray-700"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    {/* Suppliers Info */}
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                          <UserIcon className="h-4 w-4 text-red-400" />
                                        </div>
                                        <span className="text-white font-medium">{mergedData?.name || "مورد محذوف"}</span>
                                      </div>
                                      <span className="text-gray-500">←</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                          <UserIcon className="h-4 w-4 text-green-400" />
                                        </div>
                                        <span className="text-white font-medium">
                                          {merge.primary_supplier?.name || "مورد"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                                      <span>
                                        الفواتير: <span className="text-white">{merge.moved_purchase_invoices_ids?.length || 0}</span>
                                      </span>
                                      <span>
                                        المدفوعات: <span className="text-white">{merge.moved_payments_ids?.length || 0}</span>
                                      </span>
                                      <span>
                                        الرصيد:{" "}
                                        <span className={merge.merged_account_balance >= 0 ? "text-red-400" : "text-green-400"}>
                                          {merge.merged_account_balance.toLocaleString()} ج.م
                                        </span>
                                      </span>
                                    </div>

                                    {/* Time Info */}
                                    <div className="flex items-center gap-2 text-sm">
                                      <ClockIcon className="h-4 w-4 text-yellow-500" />
                                      <span className={stillCanUndo ? "text-yellow-400" : "text-gray-500"}>
                                        {stillCanUndo ? (
                                          <>المتبقي: {getTimeRemaining(merge.can_undo_until)}</>
                                        ) : (
                                          "انتهت المهلة"
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Undo Button */}
                                  <button
                                    onClick={() => undoMerge(merge)}
                                    disabled={!stillCanUndo || undoingId === merge.id}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                      stillCanUndo && undoingId !== merge.id
                                        ? "bg-orange-600 hover:bg-orange-700 text-white"
                                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                                    }`}
                                  >
                                    {undoingId === merge.id ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        جاري...
                                      </>
                                    ) : (
                                      <>
                                        <ArrowUturnLeftIcon className="h-4 w-4" />
                                        فك الدمج
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-600 flex justify-end">
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                ) : mergeSuccess ? (
                  /* Success State */
                  <div className="p-8 flex flex-col items-center justify-center">
                    <CheckCircleIcon className="h-20 w-20 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">تم الدمج بنجاح!</h3>
                    <p className="text-gray-400 text-center mb-4">
                      تم دمج حساب "{supplierToMerge?.name}" في حساب "{primarySupplier?.name}"
                    </p>
                    <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg">
                      <ClockIcon className="h-5 w-5" />
                      <span className="text-sm">يمكن فك الدمج خلال 24 ساعة</span>
                    </div>
                  </div>
                ) : step === 1 ? (
                  /* Step 1: Select Suppliers */
                  <>
                    {/* Selected Suppliers Display */}
                    <div className="p-4 bg-[#2B3544] border-b border-gray-600">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Supplier to Merge (Will be deactivated) */}
                        <div
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectingFor === "merge"
                              ? "border-blue-500 bg-blue-500/10"
                              : supplierToMerge
                                ? "border-red-500/50 bg-red-500/10"
                                : "border-gray-600 bg-[#1F2937]"
                          }`}
                          onClick={() => setSelectingFor("merge")}
                        >
                          <div className="text-xs text-red-400 mb-2 font-medium">المورد المدموج (سيتم تعطيله)</div>
                          {supplierToMerge ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-red-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-white">{supplierToMerge.name}</div>
                                <div className="text-sm text-gray-400">{supplierToMerge.phone || "بدون رقم"}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-gray-500">
                              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                                <UserIcon className="h-5 w-5" />
                              </div>
                              <span>اختر المورد المراد دمجه</span>
                            </div>
                          )}
                        </div>

                        {/* Primary Supplier (Will remain) */}
                        <div
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectingFor === "primary"
                              ? "border-blue-500 bg-blue-500/10"
                              : primarySupplier
                                ? "border-green-500/50 bg-green-500/10"
                                : "border-gray-600 bg-[#1F2937]"
                          }`}
                          onClick={() => setSelectingFor("primary")}
                        >
                          <div className="text-xs text-green-400 mb-2 font-medium">المورد الأساسي (سيبقى)</div>
                          {primarySupplier ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-green-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-white">{primarySupplier.name}</div>
                                <div className="text-sm text-gray-400">{primarySupplier.phone || "بدون رقم"}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-gray-500">
                              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                                <UserIcon className="h-5 w-5" />
                              </div>
                              <span>اختر المورد الأساسي</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Swap Button Below */}
                      {supplierToMerge && primarySupplier && (
                        <div className="flex justify-center mt-3">
                          <button
                            onClick={swapSuppliers}
                            className="flex items-center gap-2 px-4 py-2 bg-[#374151] rounded-lg border border-gray-500 hover:bg-[#4B5563] transition-colors text-gray-300 text-sm"
                          >
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                            تبديل الموردين
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-gray-600">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="البحث عن مورد بالاسم أو الهاتف أو البريد..."
                          className="w-full pl-4 pr-12 py-3 bg-[#2B3544] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {selectingFor === "merge"
                          ? "اختر المورد الذي سيتم دمجه (سيتم تعطيله)"
                          : "اختر المورد الأساسي (سيبقى ببياناته)"}
                      </p>
                    </div>

                    {/* Suppliers List */}
                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                          <p className="text-gray-400">جاري تحميل الموردين...</p>
                        </div>
                      ) : filteredSuppliers.length > 0 ? (
                        <div className="p-2 space-y-1">
                          {filteredSuppliers.map((supplier) => {
                            const isSelected = supplierToMerge?.id === supplier.id || primarySupplier?.id === supplier.id;
                            const isDefault = isDefaultSupplier(supplier);

                            return (
                              <button
                                key={supplier.id}
                                onClick={() => !isDefault && handleSelectSupplier(supplier)}
                                disabled={isDefault}
                                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border-2 ${
                                  isDefault
                                    ? "bg-gray-600/20 border-gray-700 cursor-not-allowed opacity-50"
                                    : isSelected
                                      ? supplierToMerge?.id === supplier.id
                                        ? "bg-red-500/10 border-red-500/50"
                                        : "bg-green-500/10 border-green-500/50"
                                      : "bg-[#2B3544] border-transparent hover:bg-[#374151] hover:border-gray-500"
                                } text-gray-200`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    supplierToMerge?.id === supplier.id
                                      ? "bg-red-500/20"
                                      : primarySupplier?.id === supplier.id
                                        ? "bg-green-500/20"
                                        : "bg-[#374151]"
                                  }`}>
                                    <UserIcon className={`h-5 w-5 ${
                                      supplierToMerge?.id === supplier.id
                                        ? "text-red-400"
                                        : primarySupplier?.id === supplier.id
                                          ? "text-green-400"
                                          : ""
                                    }`} />
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold flex items-center gap-2">
                                      {supplier.name}
                                      {isDefault && (
                                        <span className="text-xs bg-gray-600 text-gray-400 px-2 py-0.5 rounded-lg">
                                          لا يمكن دمجه
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-400 flex items-center gap-3">
                                      {supplier.phone && <span>{supplier.phone}</span>}
                                      {supplier.email && <span className="text-gray-500">{supplier.email}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <div className={`font-medium ${
                                    (supplierBalances[supplier.id] ?? 0) > 0
                                      ? "text-red-400"
                                      : (supplierBalances[supplier.id] ?? 0) < 0
                                        ? "text-green-400"
                                        : "text-gray-400"
                                  }`}>
                                    {(supplierBalances[supplier.id] ?? 0).toLocaleString()} ج.م
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <UserIcon className="h-12 w-12 text-gray-500 mb-4" />
                          <p className="text-gray-400">لا توجد نتائج</p>
                        </div>
                      )}
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-600 flex justify-between items-center">
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={proceedToConfirm}
                        disabled={!supplierToMerge || !primarySupplier}
                        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                          supplierToMerge && primarySupplier
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        التالي - مراجعة الدمج
                      </button>
                    </div>
                  </>
                ) : (
                  /* Step 2: Confirm Merge */
                  <>
                    <div className="p-6">
                      {/* Warning */}
                      <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-xl flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-yellow-500 mb-1">تنبيه مهم</h4>
                          <p className="text-sm text-yellow-400/80">
                            سيتم نقل جميع فواتير المشتريات والمدفوعات والرصيد من حساب "{supplierToMerge?.name}"
                            إلى حساب "{primarySupplier?.name}". يمكنك فك الدمج خلال 24 ساعة فقط.
                          </p>
                        </div>
                      </div>

                      {/* Merge Summary */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* From Supplier */}
                        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                          <div className="text-xs text-red-400 mb-3 font-medium">سيتم نقل من:</div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                              <UserIcon className="h-6 w-6 text-red-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-lg">{supplierToMerge?.name}</div>
                              <div className="text-sm text-gray-400">{supplierToMerge?.phone || "بدون رقم"}</div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                فواتير المشتريات
                              </span>
                              <span className="text-white font-medium">{mergeStats?.invoicesCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                المدفوعات
                              </span>
                              <span className="text-white font-medium">{mergeStats?.paymentsCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                الرصيد
                              </span>
                              <span className={`font-medium ${
                                (mergeStats?.calculatedBalance || 0) > 0 ? "text-red-400" : (mergeStats?.calculatedBalance || 0) < 0 ? "text-green-400" : "text-gray-400"
                              }`}>
                                {(mergeStats?.calculatedBalance || 0).toLocaleString()} ج.م
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* To Supplier */}
                        <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-4">
                          <div className="text-xs text-green-400 mb-3 font-medium">سيتم الدمج في:</div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                              <UserIcon className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-lg">{primarySupplier?.name}</div>
                              <div className="text-sm text-gray-400">{primarySupplier?.phone || "بدون رقم"}</div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                فواتير المشتريات (بعد الدمج)
                              </span>
                              <span className="text-white font-medium">
                                {(primaryStats?.invoicesCount || 0) + (mergeStats?.invoicesCount || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                المدفوعات (بعد الدمج)
                              </span>
                              <span className="text-white font-medium">
                                {(primaryStats?.paymentsCount || 0) + (mergeStats?.paymentsCount || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                الرصيد (بعد الدمج)
                              </span>
                              <span className={`font-medium ${
                                ((primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0)) > 0
                                  ? "text-red-400"
                                  : ((primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0)) < 0
                                    ? "text-green-400"
                                    : "text-gray-400"
                              }`}>
                                {((primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0)).toLocaleString()} ج.م
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Undo Notice */}
                      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3">
                        <ClockIcon className="h-6 w-6 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-blue-400">
                            <span className="font-semibold">ملاحظة:</span> يمكنك فك الدمج واسترجاع الحسابين منفصلين خلال 24 ساعة فقط من الآن.
                            بعد انتهاء هذه المدة، يصبح الدمج نهائياً ولا يمكن التراجع عنه.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-600 flex justify-between items-center">
                      <button
                        onClick={() => setStep(1)}
                        disabled={isMerging}
                        className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                      >
                        رجوع
                      </button>
                      <button
                        onClick={executeMerge}
                        disabled={isMerging}
                        className={`px-8 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                          isMerging
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                      >
                        {isMerging ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            جاري الدمج...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5" />
                            تأكيد الدمج
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
