import { createContext, useContext } from 'react'

export type AdminProductCode = 'FOOTBALL' | 'CLUBS'

const AdminProductContext = createContext<AdminProductCode>('CLUBS')

export const AdminProductProvider = AdminProductContext.Provider

// Hook lives next to the provider; Fast Refresh limitation is accepted here.
// eslint-disable-next-line react-refresh/only-export-components
export const useAdminProduct = () => useContext(AdminProductContext)
