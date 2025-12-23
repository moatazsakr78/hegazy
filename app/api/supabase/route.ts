import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple Supabase client setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'hegazy'
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const { action, productId, branchId, quantity, auditStatus } = await request.json()
    
    console.log('API request:', { action, productId, branchId, quantity, auditStatus })
    
    if (action === 'update_inventory') {
      // Use stored procedure with SECURITY DEFINER to bypass RLS
      const { data, error } = await supabase
        .rpc('update_inventory_quantity', {
          input_product_id: productId,
          input_branch_id: branchId,
          input_quantity: parseInt(quantity)
        })
        
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Successfully updated inventory:', data)
      
      return NextResponse.json({ 
        success: true, 
        data,
        message: 'Inventory updated successfully' 
      })
    }
    
    if (action === 'update_audit_status') {
      console.log('Updating audit status:', { productId, branchId, auditStatus })
      
      // First check if the record exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('inventory')
        .select('id, audit_status, product_id, branch_id')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .maybeSingle()
        
      if (checkError) {
        console.error('Error checking record:', checkError)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error checking inventory record',
            details: checkError.message 
          },
          { status: 500 }
        )
      }
      
      if (!existingRecord) {
        console.error('No inventory record found for:', { productId, branchId })
        return NextResponse.json(
          { 
            success: false, 
            error: 'No inventory record found for this product and branch',
            details: { productId, branchId }
          },
          { status: 404 }
        )
      }
      
      console.log('Found existing record:', existingRecord)
      
      // Update the record
      const { data, error } = await supabase
        .from('inventory')
        .update({ 
          audit_status: auditStatus,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingRecord.id)
        .select('*')
        .single()
        
      if (error) {
        console.error('Update error:', error)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to update audit status',
            details: error.message 
          },
          { status: 500 }
        )
      }
      
      console.log('Successfully updated audit status:', data)
      
      // Note: Cache invalidation should be handled by the real-time subscription
      // No manual cache clearing needed here
      
      return NextResponse.json({ 
        success: true, 
        data: data,
        message: `Audit status updated to "${auditStatus}"`,
        previousStatus: existingRecord.audit_status
      })
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid action' 
      },
      { status: 400 }
    )
    
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        details: error
      },
      { status: 500 }
    )
  }
}