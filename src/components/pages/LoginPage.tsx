import { useAuth, Role } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { Wordmark } from "../ui/Wordmark";

export function LoginPage() {
  const { login } = useAuth();

  const handleLogin = (role: Role) => {
    login(role);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="mb-12">
        <Wordmark className="w-32 h-auto text-foreground" />
      </div>
      <div className="max-w-md w-full bg-surface border border-border p-8 rounded-xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Select Demo Role</h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Engine Authentication</p>
        </div>
        
        <div className="grid gap-3">
          <Button onClick={() => handleLogin('operator')} variant="default" className="w-full justify-start text-left h-auto py-3">
            <div>
              <div className="font-semibold text-sm">Operator (Default)</div>
              <div className="text-xs opacity-80 font-normal">Can run checks, resolve issues, prepare manifest</div>
            </div>
          </Button>
          <Button onClick={() => handleLogin('approver')} variant="outline" className="w-full justify-start text-left h-auto py-3">
            <div>
              <div className="font-semibold text-sm">Approver</div>
              <div className="text-xs opacity-80 font-normal">Can approve an exact revision</div>
            </div>
          </Button>
          <Button onClick={() => handleLogin('client')} variant="outline" className="w-full justify-start text-left h-auto py-3">
            <div>
              <div className="font-semibold text-sm">Client</div>
              <div className="text-xs opacity-80 font-normal">Can edit intake fields and review findings</div>
            </div>
          </Button>
          <Button onClick={() => handleLogin('viewer')} variant="outline" className="w-full justify-start text-left h-auto py-3">
            <div>
              <div className="font-semibold text-sm">Viewer</div>
              <div className="text-xs opacity-80 font-normal">Read-only access</div>
            </div>
          </Button>
        </div>
        
        <div className="text-center pt-4 border-t border-border mt-6 text-xs text-muted-foreground">
          <p>Running in DEMO_MODE with synthetic data persistence.</p>
        </div>
      </div>
    </div>
  );
}
