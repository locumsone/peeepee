import { Home, Briefcase, Users, BarChart3, FilePlus, MessageSquare, Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import logoImage from "@/assets/logo.png";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Candidates", url: "/candidates/search", icon: Users },
  { title: "Communications", url: "/communications", icon: MessageSquare },
  { title: "Enrichment", url: "/enrichment", icon: Sparkles },
  { title: "Campaigns", url: "/campaigns", icon: BarChart3 },
  { title: "New Job", url: "/jobs/new", icon: FilePlus },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="relative">
            <img 
              src={logoImage} 
              alt="Locums One" 
              className="h-9 w-9 rounded-lg shrink-0 transition-all duration-300 group-hover:shadow-glow"
            />
            {/* Glow ring on hover */}
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 ring-2 ring-primary/50" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold text-foreground tracking-tight">
                Locums One
              </span>
              <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                Campaign Builder
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-150 group"
                      activeClassName="bg-primary/15 text-primary font-medium border-l-2 border-primary rounded-l-none"
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-primary" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with version/status */}
      {!collapsed && (
        <div className="mt-auto p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              System Online
            </span>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
