'use client'

import { supabase } from '../supabase/client'

export interface CartItem {
  id: string
  product: any
  quantity: number
  selectedColors?: { [key: string]: number } | null
  price: number
  total: number
}

export interface InvoiceSelections {
  customer: any
  branch: any
  record: any
}

export interface PaymentEntry {
  id: string
  amount: number
  paymentMethodId: string
}

export interface CreateSalesInvoiceParams {
  cartItems: CartItem[]
  selections: InvoiceSelections
  paymentMethod?: string
  notes?: string
  isReturn?: boolean
  paymentSplitData?: PaymentEntry[]
  creditAmount?: number
  userId?: string | null
  userName?: string | null
}

export async function createSalesInvoice({
  cartItems,
  selections,
  paymentMethod = 'cash',
  notes,
  isReturn = false,
  paymentSplitData = [],
  creditAmount = 0,
  userId = null,
  userName = null
}: CreateSalesInvoiceParams) {
  if (!selections.branch) {
    throw new Error('يجب تحديد الفرع قبل إنشاء الفاتورة')
  }

  // Check if "no safe" option was selected (record.id is null)
  const hasNoSafe = !selections.record || !selections.record.id;

  if (!cartItems || cartItems.length === 0) {
    throw new Error('لا يمكن إنشاء فاتورة بدون منتجات')
  }

  // Use default customer if none selected
  const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001' // The default customer from database
  const customerId = (selections.customer && selections.customer.id) ? selections.customer.id : DEFAULT_CUSTOMER_ID

  console.log('Customer selection debug:', {
    hasCustomer: !!selections.customer,
    customerId: customerId,
    rawCustomer: selections.customer
  })

  // Validate that customerId is a valid UUID and not null/undefined
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    throw new Error(`خطأ في معرف العميل: ${customerId}`)
  }

  try {
    // Validate cart items
    for (const item of cartItems) {
      if (!item.product || !item.product.id) {
        throw new Error(`منتج غير صالح في السلة: ${JSON.stringify(item)}`)
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`كمية غير صالحة للمنتج ${item.product.name}: ${item.quantity}`)
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        throw new Error(`سعر غير صالح للمنتج ${item.product.name}: ${item.price}`)
      }
    }

    // Calculate totals (negative for returns)
    const baseTotal = cartItems.reduce((sum, item) => sum + item.total, 0)
    const totalAmount = isReturn ? -baseTotal : baseTotal
    const taxAmount = 0 // You can add tax calculation here if needed
    const discountAmount = 0 // You can add discount calculation here if needed
    const profit = cartItems.reduce((sum, item) => {
      const costPrice = item.product.cost_price || 0
      const itemProfit = (item.price - costPrice) * item.quantity
      return sum + (isReturn ? -itemProfit : itemProfit)
    }, 0)

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // Get current time as full ISO timestamp
    const now = new Date()
    const timeString = now.toISOString() // Full ISO format with timezone

    console.log('Creating sales invoice with data:', {
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      profit: profit,
      payment_method: paymentMethod,
      branch_id: selections.branch.id,
      customer_id: customerId,
      record_id: hasNoSafe ? null : selections.record.id,
      notes: notes || null,
      time: timeString,
      invoice_type: (isReturn ? 'Sale Return' : 'Sale Invoice'),
      no_safe_selected: hasNoSafe
    })

    // Start transaction
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .insert({
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        profit: profit,
        payment_method: paymentMethod,
        branch_id: selections.branch.id,
        customer_id: customerId,
        record_id: hasNoSafe ? null : selections.record.id,
        notes: hasNoSafe ? `${notes || ''} [بدون خزنة]`.trim() : (notes || null),
        time: timeString,
        invoice_type: (isReturn ? 'Sale Return' : 'Sale Invoice') as any
      })
      .select()
      .single()

    if (salesError) {
      console.error('Sales creation error:', salesError)
      throw new Error(`خطأ في إنشاء الفاتورة: ${salesError.message}`)
    }

    console.log('Sales invoice created successfully:', salesData)

    // Create sale items (negative quantities for returns)
    const saleItems = cartItems.map(item => {
      // تنسيق النص العربي بشكل صحيح
      let notesText = null
      if (item.selectedColors && Object.keys(item.selectedColors).length > 0) {
        const colorEntries = Object.entries(item.selectedColors as Record<string, number>)
          .filter(([color, qty]) => qty > 0)
          .map(([color, qty]) => `${color}: ${qty}`)
          .join(', ')
        if (colorEntries) {
          notesText = `الألوان المحددة: ${colorEntries}`
        }
      }
      
      return {
        sale_id: salesData.id,
        product_id: item.product.id,
        quantity: isReturn ? -item.quantity : item.quantity,
        unit_price: item.price,
        cost_price: item.product.cost_price || 0,
        discount: 0,
        notes: notesText
      }
    })

    console.log('Attempting to insert sale items:', saleItems)
    
    const { data: saleItemsData, error: saleItemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)
      .select()

    if (saleItemsError) {
      console.error('Sale items error:', saleItemsError)
      console.error('Sale items data that failed:', saleItems)
      // If sale items creation fails, we should clean up the sale record
      await supabase.from('sales').delete().eq('id', salesData.id)
      throw new Error(`خطأ في إضافة عناصر الفاتورة: ${saleItemsError.message}`)
    }

    console.log('Sale items created successfully:', saleItemsData)

    // Note: Invoices are only assigned to the selected safe - no duplication to main safe
    // Each safe shows only its own invoices

    // Update inventory quantities
    for (const item of cartItems) {
      // First get current quantity, then update
      const { data: currentInventory, error: getError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product.id)
        .eq('branch_id', selections.branch.id)
        .single()

      if (getError) {
        console.warn(`Failed to get current inventory for product ${item.product.id}:`, getError.message)
        continue
      }

      // For returns, add quantity back; for sales, subtract
      const quantityChange = isReturn ? item.quantity : -item.quantity
      const newQuantity = Math.max(0, (currentInventory?.quantity || 0) + quantityChange)

      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({
          quantity: newQuantity
        })
        .eq('product_id', item.product.id)
        .eq('branch_id', selections.branch.id)

      if (inventoryError) {
        console.warn(`Failed to update inventory for product ${item.product.id}:`, inventoryError.message)
        // Don't throw error here as the sale was created successfully
      }

      // Update product variant quantities if the item has color selections
      if (item.selectedColors && Object.keys(item.selectedColors).length > 0) {
        for (const [colorName, colorQuantity] of Object.entries(item.selectedColors as Record<string, number>)) {
          if (colorQuantity > 0) {
            // First, get the variant definition ID from product_color_shape_definitions
            const { data: variantDefinition, error: defError } = await supabase
              .from('product_color_shape_definitions')
              .select('id')
              .eq('product_id', item.product.id)
              .eq('name', colorName)
              .eq('variant_type', 'color')
              .single()

            if (defError || !variantDefinition) {
              console.warn(`Failed to get variant definition for product ${item.product.id}, color ${colorName}:`, defError?.message)
              continue
            }

            // Get current quantity from product_variant_quantities
            const { data: currentQuantity, error: qtyGetError } = await supabase
              .from('product_variant_quantities')
              .select('quantity')
              .eq('variant_definition_id', variantDefinition.id)
              .eq('branch_id', selections.branch.id)
              .single()

            if (qtyGetError && qtyGetError.code !== 'PGRST116') {
              console.warn(`Failed to get current quantity for variant ${variantDefinition.id}:`, qtyGetError.message)
              continue
            }

            // For returns, add quantity back; for sales, subtract
            const variantQuantityChange = isReturn ? colorQuantity : -colorQuantity
            const newVariantQuantity = Math.max(0, (currentQuantity?.quantity || 0) + variantQuantityChange)

            // Update or insert quantity in product_variant_quantities
            const { error: qtyUpdateError } = await supabase
              .from('product_variant_quantities')
              .upsert({
                variant_definition_id: variantDefinition.id,
                branch_id: selections.branch.id,
                quantity: newVariantQuantity,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'variant_definition_id,branch_id'
              })

            if (qtyUpdateError) {
              console.warn(`Failed to update variant quantity for variant ${variantDefinition.id}:`, qtyUpdateError.message)
              // Don't throw error here as the sale was created successfully
            }
          }
        }
      }
    }

    // Save payment split data to customer_payments table
    if (!isReturn && paymentSplitData && paymentSplitData.length > 0) {
      for (const payment of paymentSplitData) {
        if (payment.amount > 0 && payment.paymentMethodId) {
          // Get payment method name from ID
          const { data: paymentMethodData } = await supabase
            .from('payment_methods')
            .select('name')
            .eq('id', payment.paymentMethodId)
            .single()

          const paymentMethodName = paymentMethodData?.name || 'cash'

          const { error: paymentError } = await supabase
            .from('customer_payments')
            .insert({
              customer_id: customerId,
              amount: payment.amount,
              payment_method: paymentMethodName,
              notes: `دفعة من فاتورة رقم ${invoiceNumber}`,
              payment_date: new Date().toISOString().split('T')[0],
              created_by: userId || null,
              safe_id: selections.record?.id || null
            })

          if (paymentError) {
            console.warn('Failed to save payment entry:', paymentError.message)
            console.error('Payment error details:', paymentError)
          } else {
            console.log(`✅ Payment saved: ${payment.amount} via ${paymentMethodName}`)
          }
        }
      }
    }

    // Note: Customer balance is calculated dynamically as:
    // Balance = (Total Sales) - (Total Payments)
    // No need to update account_balance in customers table
    // The balance is computed in real-time from sales and customer_payments tables

    // Update cash drawer balance
    // Skip if "no safe" option was selected - money goes to pocket instead of drawer
    if (hasNoSafe) {
      console.log('⏭️ Skipping cash drawer update - "لا يوجد" (no safe) option selected')
    } else {
    // Calculate cash amount from payments (cash payments go to drawer)
    let cashToDrawer = 0

    if (paymentSplitData && paymentSplitData.length > 0) {
      // If there's split payment data, find cash payments
      for (const payment of paymentSplitData) {
        if (payment.amount > 0 && payment.paymentMethodId) {
          // Get payment method to check if it's cash
          const { data: paymentMethodData } = await supabase
            .from('payment_methods')
            .select('name')
            .eq('id', payment.paymentMethodId)
            .single()

          // If payment method is cash (نقدي or cash), add to drawer
          if (paymentMethodData?.name?.toLowerCase() === 'cash' ||
              paymentMethodData?.name === 'نقدي' ||
              paymentMethodData?.name === 'كاش') {
            cashToDrawer += payment.amount
          }
        }
      }
      // للمرتجعات: الفلوس تخرج من الخزنة (قيمة سالبة)
      if (isReturn) {
        cashToDrawer = -cashToDrawer
      }
    } else if (paymentMethod === 'cash' || paymentMethod === 'نقدي') {
      // If no split payment and payment method is cash, entire amount goes to drawer
      // For returns, this will be negative (money out of drawer)
      cashToDrawer = totalAmount - (creditAmount || 0)
    }

    // Update drawer if there's cash to add/remove
    if (cashToDrawer !== 0) {
      try {
        // Get or create drawer for this record
        let { data: drawer, error: drawerError } = await supabase
          .from('cash_drawers')
          .select('*')
          .eq('record_id', selections.record.id)
          .single()

        if (drawerError && drawerError.code === 'PGRST116') {
          // Drawer doesn't exist, create it
          const { data: newDrawer, error: createError } = await supabase
            .from('cash_drawers')
            .insert({ record_id: selections.record.id, current_balance: 0 })
            .select()
            .single()

          if (!createError) {
            drawer = newDrawer
          }
        }

        if (drawer) {
          // Calculate new balance (for returns, cashToDrawer is negative)
          const newBalance = (drawer.current_balance || 0) + cashToDrawer

          // Update drawer balance
          await supabase
            .from('cash_drawers')
            .update({
              current_balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', drawer.id)

          // Create transaction record
          await supabase
            .from('cash_drawer_transactions')
            .insert({
              drawer_id: drawer.id,
              record_id: selections.record.id,
              transaction_type: isReturn ? 'return' : 'sale',
              amount: cashToDrawer,
              balance_after: newBalance,
              sale_id: salesData.id,
              notes: isReturn
                ? `مرتجع - فاتورة رقم ${invoiceNumber}`
                : `بيع - فاتورة رقم ${invoiceNumber}`,
              performed_by: userName || 'system'
            })

          console.log(`✅ Cash drawer updated: ${cashToDrawer >= 0 ? '+' : ''}${cashToDrawer}, new balance: ${newBalance}`)
        }
      } catch (drawerError) {
        console.warn('Failed to update cash drawer:', drawerError)
        // Don't throw error here as the sale was created successfully
      }
    }
    } // End of else block for hasNoSafe check

    return {
      success: true,
      invoiceId: salesData.id,
      invoiceNumber: invoiceNumber,
      totalAmount: totalAmount,
      message: 'تم إنشاء الفاتورة بنجاح'
    }

  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء إنشاء الفاتورة')
  }
}