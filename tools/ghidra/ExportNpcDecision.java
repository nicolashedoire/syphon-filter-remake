// Exports a single manually chosen function for comparison; no source reconstruction is claimed.
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;

public class ExportNpcDecision extends GhidraScript {
    public void run() throws Exception {
        Address entry = toAddr("8005d988");
        println("Program: " + currentProgram.getName() + " language: " + currentProgram.getLanguageID());
        println("Address: " + entry + " mapped: " + currentProgram.getMemory().contains(entry));
        disassemble(entry);
        Function f = createFunction(entry, "candidate_decision_routine");
        if (f == null) { println("Unable to create function"); return; }
        DecompInterface d = new DecompInterface();
        if (!d.openProgram(currentProgram)) throw new IllegalStateException("Unable to open decompiler");
        DecompileResults r = d.decompileFunction(f, 30, monitor);
        println("Completed: " + r.decompileCompleted());
        if (r.decompileCompleted()) println(r.getDecompiledFunction().getC());
        else println("Error: " + r.getErrorMessage());
        d.dispose();
    }
}
