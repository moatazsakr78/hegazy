'use client'

import { supabase } from '../supabase/client'
import { CartItem } from './createSalesInvoice'
import { updateProductCostAfterPurchase } from '../utils/purchase-cost-management'

export interface PurchaseInvoiceSelections {
  supplier: any
  warehouse: any
  record: any
}

export interface CreatePurchaseInvoiceParams {
  cartItems: CartItem[]
  selections: PurchaseInvoiceSelections
  paymentMethod?: string
  notes?: string
  isReturn?: boolean
}

// Helper function to create new products in database
async function createNewProductInDatabase(product: any): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      price: product.price || 0,
      cost_price: product.cost_price || 0,
      barcode: product.barcode || null,
      description: product.description || null,
      main_image_url: product.main_image_url || null,
      is_active: true
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`فشل في إنشاء المنتج "${product.name}": ${error.message}`)
  }

  return data.id
}

export async function createPurchaseInvoice({
  cartItems,
  selections,
  paymentMethod = 'cash',
  notes,
  isReturn = false
}: CreatePurchaseInvoiceParams) {
  if (!selections.supplier || !selections.warehouse) {
    throw new Error('يجب تحديد المورد والمخزن قبل إنشاء فاتورة الشراء')
  }

  // Check if "no safe" option was selected (record.id is null)
  const hasNoSafe = !selections.record || !selections.record.id;

  if (!cartItems || cartItems.length === 0) {
    throw new Error('لا يمكن إنشاء فاتورة شراء بدون منتجات')
  }

  try {
    // First, handle new products (those with temp- IDs)
    // Create them in database and update their IDs
    const processedCartItems = await Promise.all(
      cartItems.map(async (item) => {
        const productId = String(item.product.id)

        // Check if this is a temporary product (new product from QuickAddProductModal)
        if (productId.startsWith('temp-')) {
          console.log(`🆕 Creating new product in database: ${item.product.name}`)

          // Create the product in database and get real ID
          const realProductId = await createNewProductInDatabase(item.product)

          console.log(`✅ Product created with ID: ${realProductId}`)

          // Return updated cart item with real product ID
          return {
            ...item,
            product: {
              ...item.product,
              id: realProductId
            }
          }
        }

        // Return unchanged item for existing products
        return item
      })
    )

    // Use processed cart items with real product IDs
    const finalCartItems = processedCartItems

    // Calculate totals (negative for returns)
    const baseTotal = finalCartItems.reduce((sum, item) => sum + item.total, 0)
    const totalAmount = isReturn ? -baseTotal : baseTotal
    const taxAmount = 0 // You can add tax calculation here if needed
    const discountAmount = 0 // You can add discount calculation here if needed
    const netAmount = totalAmount - discountAmount + taxAmount

    // Generate invoice number
    const invoiceNumber = `PINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // Get current time
    const now = new Date()
    const timeString = now.toTimeString().split(' ')[0] // HH:MM:SS format

    // Determine location IDs based on warehouse selection
    const branchId = selections.warehouse.locationType === 'branch' ? selections.warehouse.id : null
    const warehouseId = selections.warehouse.locationType === 'warehouse' ? selections.warehouse.id : null

    // Start transaction - Create purchase invoice
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchase_invoices')
      .insert({
        invoice_number: invoiceNumber,
        supplier_id: selections.supplier.id,
        invoice_date: now.toISOString().split('T')[0], // Current date in YYYY-MM-DD format
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        net_amount: netAmount,
        payment_status: 'pending', // Can be 'pending', 'paid', 'partial'
        notes: hasNoSafe ? `${notes || ''} [بدون خزنة]`.trim() : (notes || null),
        branch_id: branchId,
        warehouse_id: warehouseId,
        record_id: hasNoSafe ? null : selections.record.id,
        time: timeString,
        invoice_type: (isReturn ? 'Purchase Return' : 'Purchase Invoice') as any,
        is_active: true
      })
      .select()
      .single()

    if (purchaseError) {
      throw new Error(`خطأ في إنشاء فاتورة الشراء: ${purchaseError.message}`)
    }

    // Create purchase invoice items
    const purchaseItems = finalCartItems.map(item => ({
      purchase_invoice_id: purchaseData.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_purchase_price: item.price,
      total_price: item.total,
      discount_amount: 0, // You can add item-level discount if needed
      tax_amount: 0, // You can add item-level tax if needed
      notes: item.selectedColors ? `الألوان: ${Object.entries(item.selectedColors).map(([color, qty]) => `${color} (${qty})`).join(', ')}` : 'غير محدد - وضع الشراء'
    }))

    const { error: purchaseItemsError } = await supabase
      .from('purchase_invoice_items')
      .insert(purchaseItems)

    if (purchaseItemsError) {
      // If purchase items creation fails, we should clean up the purchase invoice record
      await supabase.from('purchase_invoices').delete().eq('id', purchaseData.id)
      throw new Error(`خطأ في إضافة عناصر فاتورة الشراء: ${purchaseItemsError.message}`)
    }

    // NOTE: Removed the logic that creates a copy in the main record
    // Now purchase invoices only appear in the explicitly selected safe
    // If "no safe" is selected (hasNoSafe = true), record_id will be null and won't appear in any safe

    // Update inventory quantities (increase for purchases)
    const locationId = branchId || warehouseId

    for (const item of finalCartItems) {
      // Check if inventory record exists for this product and location
      const { data: existingInventory, error: getInventoryError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product.id)
        .eq(branchId ? 'branch_id' : 'warehouse_id', locationId)
        .single()

      if (getInventoryError && getInventoryError.code !== 'PGRST116') {
        console.warn(`Failed to get current inventory for product ${item.product.id}:`, getInventoryError.message)
        continue
      }

      if (existingInventory) {
        // Update existing inventory (for returns, subtract; for purchases, add)
        const quantityChange = isReturn ? -item.quantity : item.quantity
        const newQuantity = Math.max(0, (existingInventory.quantity || 0) + quantityChange)

        const updateData: any = { quantity: newQuantity }
        if (branchId) {
          updateData.branch_id = branchId
        } else {
          updateData.warehouse_id = warehouseId
        }

        const { error: inventoryError } = await supabase
          .from('inventory')
          .update(updateData)
          .eq('product_id', item.product.id)
          .eq(branchId ? 'branch_id' : 'warehouse_id', locationId)

        if (inventoryError) {
          console.warn(`Failed to update inventory for product ${item.product.id}:`, inventoryError.message)
        }
      } else {
        // Create new inventory record (only if not a return or return quantity is positive)
        const effectiveQuantity = isReturn ? 0 : item.quantity // Don't create inventory for returns
        if (effectiveQuantity > 0) {
          const insertData: any = {
            product_id: item.product.id,
            quantity: effectiveQuantity,
            min_stock: 0 // Default minimum stock
          }
        
          if (branchId) {
            insertData.branch_id = branchId
          } else {
            insertData.warehouse_id = warehouseId
          }

          const { error: inventoryError } = await supabase
            .from('inventory')
            .insert(insertData)

          if (inventoryError) {
            console.warn(`Failed to create inventory for product ${item.product.id}:`, inventoryError.message)
          }
        }
      }

      // In purchase mode, we store quantities as "unspecified" variant
      // Only track variant quantities for branches (not warehouses)
      if (branchId) {
        // First, check if an "غير محدد" definition exists for this product
        const { data: unspecifiedDef, error: defError } = await supabase
          .from('product_color_shape_definitions')
          .select('id')
          .eq('product_id', item.product.id)
          .eq('name', 'غير محدد')
          .eq('variant_type', 'color')
          .single()

        let unspecifiedDefId: string

        if (defError || !unspecifiedDef) {
          // Create the "غير محدد" definition if it doesn't exist
          const { data: newDef, error: createDefError } = await supabase
            .from('product_color_shape_definitions')
            .insert({
              product_id: item.product.id,
              variant_type: 'color',
              name: 'غير محدد',
              color_hex: '#6B7280',
              sort_order: 9999 // Put it at the end
            })
            .select('id')
            .single()

          if (createDefError || !newDef) {
            console.warn(`Failed to create unspecified definition for product ${item.product.id}:`, createDefError?.message)
            continue
          }
          unspecifiedDefId = newDef.id
        } else {
          unspecifiedDefId = unspecifiedDef.id
        }

        // Now manage the quantity in product_variant_quantities
        const { data: currentQty, error: qtyGetError } = await supabase
          .from('product_variant_quantities')
          .select('quantity')
          .eq('variant_definition_id', unspecifiedDefId)
          .eq('branch_id', branchId)
          .single()

        if (qtyGetError && qtyGetError.code !== 'PGRST116') {
          console.warn(`Failed to get current quantity for unspecified variant:`, qtyGetError.message)
          continue
        }

        // Calculate new quantity (for returns, subtract; for purchases, add)
        const quantityChange = isReturn ? -item.quantity : item.quantity
        const newVariantQuantity = Math.max(0, (currentQty?.quantity || 0) + quantityChange)

        // Upsert the quantity
        const { error: qtyUpsertError } = await supabase
          .from('product_variant_quantities')
          .upsert({
            variant_definition_id: unspecifiedDefId,
            branch_id: branchId,
            quantity: newVariantQuantity,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'variant_definition_id,branch_id'
          })

        if (qtyUpsertError) {
          console.warn(`Failed to upsert quantity for unspecified variant:`, qtyUpsertError.message)
        }
      }
    }

    // Update product costs using weighted average cost method
    console.log('🔄 Updating product costs after purchase...')
    for (const item of finalCartItems) {
      try {
        const costUpdate = await updateProductCostAfterPurchase(
          item.product.id,
          item.quantity,
          item.price
        )
        
        if (costUpdate) {
          console.log(`💰 Updated cost for product ${item.product.id}:`, {
            oldCost: 'calculated from previous data',
            newCost: costUpdate.newAverageCost,
            quantity: item.quantity,
            unitPrice: item.price
          })
        } else {
          console.warn(`⚠️  Failed to update cost for product ${item.product.id}`)
        }
      } catch (costError: any) {
        console.error(`❌ Error updating cost for product ${item.product.id}:`, costError.message)
        // Don't fail the entire invoice creation if cost update fails
      }
    }

    return {
      success: true,
      invoiceId: purchaseData.id,
      invoiceNumber: invoiceNumber,
      totalAmount: totalAmount,
      message: 'تم إنشاء فاتورة الشراء وتحديث تكاليف المنتجات بنجاح'
    }

  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء إنشاء فاتورة الشراء')
  }
}