import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import java.nio.charset.Charset;
import java.io.ByteArrayOutputStream;
public class InspectObjectiveDescriptor extends GhidraScript {
  private String stringAt(long address) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    for (int i=0; i<512; i++) {
      byte b = getByte(toAddr(address+i));
      if (b==0) return new String(bytes.toByteArray(), Charset.forName("windows-1252"));
      bytes.write(b);
    }
    throw new IllegalStateException("unterminated candidate string");
  }
  public void run() throws Exception {
    String[] args = getScriptArgs();
    if (args.length!=1) throw new IllegalArgumentException("expected descriptor address");
    Address descriptor = toAddr(args[0]);
    println("language="+currentProgram.getLanguageID()+" descriptor="+descriptor);
    for (int group=0;group<2;group++) {
      int count=getInt(descriptor.add(group*8));
      long array=Integer.toUnsignedLong(getInt(descriptor.add(group*8+4)));
      if(count<0 || count>25) throw new IllegalStateException("unexpected count");
      println("group="+group+" count="+count+" pointer=0x"+Long.toHexString(array));
      for(int i=0;i<count;i++) {
        long target=Integer.toUnsignedLong(getInt(toAddr(array+i*4L)));
        println("item="+i+" address=0x"+Long.toHexString(target)+" string="+stringAt(target));
      }
    }
  }
}
