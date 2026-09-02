import { fetchApi } from "../../lib/fetchApi";
import { useState, useEffect } from "react";
import { useParams, Outlet, Link, useLocation } from "react-router-dom";
import { ReadinessProject } from "../../types";
import { StateChip } from "../ui/badge";
import { getStatusColor } from "../../lib/utils";
import { useRealtime } from "../../contexts/RealtimeContext";
import { LivePresenceBar } from "../telemetry/LivePresenceBar";

export function ProjectLayout() {
  const { id } = useParams();
  const location = useLocation();
  const [project, setProject] = useState<ReadinessProject | null>(null);
  const [prevState, setPrevState] = useState<string | null>(null);
  const [glitchTrigger, setGlitchTrigger] = useState(false);
  const { joinRoom, leaveRoom, updatePresence, subscribeToProject } = useRealtime();

  const fetchProject = () => {
    fetchApi(`/api/projects/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.project) {
          if (prevState && prevState !== data.project.state) {
            setGlitchTrigger(true);
            setTimeout(() => setGlitchTrigger(false), 700);
          }
          setPrevState(data.project.state);
          setProject(data.project);
        }
      })
      .catch(console.error);
  };

  const currentTab = location.pathname.split("/").pop() || "overview";

  useEffect(() => {
    fetchProject();
  }, [id]);

  // Real-time room lifecycle
  useEffect(() => {
    if (id) {
      joinRoom(id, currentTab);
      
      const unsubscribe = subscribeToProject(id, (updatedProject) => {
        if (project && project.state !== updatedProject.state) {
          setGlitchTrigger(true);
          setTimeout(() => setGlitchTrigger(false), 700);
        }
        setProject(updatedProject);
      });

      return () => {
        unsubscribe();
        leaveRoom();
      };
    }
  }, [id, joinRoom, leaveRoom, subscribeToProject, project]);

  // Update presence on tab navigation
  useEffect(() => {
    updatePresence(currentTab);
  }, [currentTab, updatePresence]);

  if (!project) {
    return <div className="text-muted-foreground font-mono text-sm uppercase tracking-widest flex items-center h-48 justify-center">Loading project telemetry...</div>;
  }

  const isBlocked = project.state === "blocked" || project.findings.some(f => f.severity === "blocked" && f.status === "unresolved");

  const navItems = [
    { id: "overview", label: "Overview", index: "01" },
    { id: "metadata", label: "Metadata", index: "02" },
    { id: "credits", label: "Credits", index: "03" },
    { id: "assets", label: "Assets", index: "04" },
    { id: "artwork", label: "Artwork", index: "05" },
    { id: "checks", label: "Checks", index: "06" },
    { id: "review", label: "Review", index: "07" },
    { id: "manifest", label: "Manifest", index: "08" },
    { id: "activity", label: "Activity", index: "09" }
  ];

  return (
    <div className={`space-y-6 duration-300 ${glitchTrigger ? (isBlocked ? "crt-blocked-sweep glitch-transition-blocked" : "crt-refresh-sweep glitch-transition-active") : ""}`}>
      {/* System Rail / Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-3 w-full mb-2">
        <Link 
          to="/" 
          className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.16em] hover:text-foreground hardware-cut focus-visible:outline-2 focus-visible:outline-brand-hover rounded-none px-1 py-0.5 hover:bg-surface-raised"
        >
          Dashboard
        </Link>
        <span className="font-mono text-[11px] text-border-strong" aria-hidden="true">/</span>
        <span aria-current="page" className="font-mono text-[11px] text-primary-glow uppercase tracking-[0.16em] truncate max-w-[200px] sm:max-w-[300px]">
          {project.title}
        </span>
        <div className="flex-1 h-px bg-border ml-2" aria-hidden="true"></div>
      </nav>

      {/* Persistent Product Header */}
      <div className={`flex items-center bg-surface-raised px-6 py-3 border-b border-border -mx-6 md:-mx-8 mb-4 relative overflow-hidden ${isBlocked ? "border-b-destructive/40" : ""}`}>
        <div className="flex flex-col">
          <h1 className="text-sm font-mono text-muted-foreground leading-tight uppercase tracking-wider">
            PROJECT: <span className="text-foreground font-bold">{project.title}</span>
          </h1>
          <p className="text-[11px] text-muted-foreground font-mono mt-1 uppercase">
            Artist: <span className="text-foreground">{project.primaryArtist}</span> &bull; Rev: {project.revision} &bull; Owner: {project.ownerId.replace('user_', '')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex flex-col items-end px-3 border-r border-border hidden md:flex font-mono">
            <span className="text-[9px] text-muted-foreground uppercase font-mono">Readiness State</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-none ${isBlocked ? "bg-destructive animate-pulse" : "bg-primary-glow"}`}></span>
              <span className={`font-mono text-xs font-bold uppercase tracking-wider ${isBlocked ? "text-destructive font-black" : ""}`} style={{ color: !isBlocked ? `var(--${getStatusColor(project.state)})` : undefined }}>
                {project.state.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Presence Bar */}
      <LivePresenceBar />

      {/* Two-column layout for navigation and content */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        <aside className="w-full lg:w-48 shrink-0" aria-label="Project Sidebar">
          <nav aria-label="Project Sections" className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">
            {navItems.map(item => {
              const isActive = location.pathname.includes(`/readiness/${id}/${item.id}`);
              return (
                <Link
                  key={item.id}
                  to={`/readiness/${id}/${item.id}`}
                  className={`hardware-sidebar-item px-3 py-2 text-xs font-mono whitespace-nowrap focus-visible:outline-1 focus-visible:outline-brand ${
                    isActive ? "active font-bold" : "text-muted-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] opacity-40">{item.index}</span>
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="text-primary-glow text-[10px] font-bold">►</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <Outlet context={{ project, reloadProject: fetchProject, updatePresence }} />
        </div>
      </div>
    </div>
  );
}
