import * as React from "react";
import { cn } from "@/lib/utils";
const Tabs = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("w-full", className)} {...props}/>));
Tabs.displayName = "Tabs";
const TabsList = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props}/>));
TabsList.displayName = "TabsList";
const TabsTrigger = React.forwardRef(({ className, value, ...props }, ref) => {
    const [active, setActive] = React.useState(false);
    React.useEffect(() => {
        const parent = ref && "current" in ref ? ref.current?.parentElement : null;
        if (parent) {
            // Very basic mock of tabs state for now or use a context
        }
    }, [ref]);
    return (<button ref={ref} type="button" className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} {...props}/>);
});
TabsTrigger.displayName = "TabsTrigger";
const TabsContent = React.forwardRef(({ className, value, ...props }, ref) => (<div ref={ref} className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)} {...props}/>));
TabsContent.displayName = "TabsContent";
// Real implementation using Radix UI if possible, but let's do a simple one manually to avoid dependencies
const TabsContext = React.createContext({ value: "", onValueChange: () => { } });
export function TabsRoot({ defaultValue, className, children, }) {
    const [value, setValue] = React.useState(defaultValue);
    return (<TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>);
}
export function TabsListRoot({ className, children }) {
    return (<div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>
      {children}
    </div>);
}
export function TabsTriggerRoot({ value, className, children }) {
    const ctx = React.useContext(TabsContext);
    const active = ctx.value === value;
    return (<button onClick={() => ctx.onValueChange(value)} data-state={active ? "active" : "inactive"} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)}>
      {children}
    </button>);
}
export function TabsContentRoot({ value, className, children }) {
    const ctx = React.useContext(TabsContext);
    if (ctx.value !== value)
        return null;
    return (<div className={cn("mt-2 outline-none", className)}>
      {children}
    </div>);
}
export { TabsRoot as Tabs, TabsListRoot as TabsList, TabsTriggerRoot as TabsTrigger, TabsContentRoot as TabsContent };
