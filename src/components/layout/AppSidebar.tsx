import { Home, Briefcase, Users, BarChart3, FilePlus, MessageSquare } from "lucide-react";
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

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, emoji: "🏠" },
  { title: "Jobs", url: "/jobs", icon: Briefcase, emoji: "📋" },
  { title: "Candidates", url: "/candidates/search", icon: Users, emoji: "👥" },
  { title: "Communications", url: "/communications", icon: MessageSquare, emoji: "📱" },
  { title: "Campaigns", url: "/campaigns", icon: BarChart3, emoji: "📊" },
  { title: "New Job", url: "/jobs/new", icon: FilePlus, emoji: "📝" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-border/50 bg-card">
      <SidebarHeader className="border-b border-border/50 p-4">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-md group-hover:shadow-glow transition-shadow duration-300 shrink-0">
            <span className="text-xl">🐱</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold text-gradient">
                Locums One
              </span>
              <span className="text-xs text-muted-foreground -mt-0.5">
                Campaign Builder
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
                      activeClassName="bg-primary/10 text-primary font-medium border border-primary/20"
                    >
                      <span className="text-lg shrink-0">{item.emoji}</span>
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
