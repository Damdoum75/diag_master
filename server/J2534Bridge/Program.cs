using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

static class Program
{
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

  public static async Task Main()
  {
    var listener = new HttpListener();
    listener.Prefixes.Add("http://localhost:27015/");
    listener.Start();

    Console.WriteLine("J2534 Bridge (x86) listening on ws://localhost:27015/");

    while (true)
    {
      var ctx = await listener.GetContextAsync();
      if (!ctx.Request.IsWebSocketRequest)
      {
        ctx.Response.StatusCode = 400;
        ctx.Response.Close();
        continue;
      }

      var wsCtx = await ctx.AcceptWebSocketAsync(subProtocol: null);
      _ = Task.Run(() => HandleClient(wsCtx.WebSocket));
    }
  }

  private static async Task HandleClient(WebSocket ws)
  {
    var session = new BridgeSession();
    var buffer = new byte[64 * 1024];

    try
    {
      while (ws.State == WebSocketState.Open)
      {
        var msg = await ReceiveText(ws, buffer);
        if (msg is null) break;

        BridgeRequest? req;
        try
        {
          req = JsonSerializer.Deserialize<BridgeRequest>(msg, JsonOptions);
        }
        catch
        {
          continue;
        }

        if (req?.Id is null || string.IsNullOrWhiteSpace(req.Method))
        {
          continue;
        }

        try
        {
          var result = await Dispatch(session, req.Method!, req.Params);
          await SendJson(ws, new BridgeResponse { Id = req.Id.Value, Result = result });
        }
        catch (Exception ex)
        {
          await SendJson(ws, new BridgeResponse { Id = req.Id.Value, Error = ex.Message });
        }
      }
    }
    finally
    {
      try
      {
        session.Dispose();
      }
      catch { }

      try
      {
        if (ws.State == WebSocketState.Open)
        {
          await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
        }
      }
      catch { }
    }
  }

  private static async Task<object?> Dispatch(BridgeSession session, string method, JsonElement? @params)
  {
    return method switch
    {
      "PassThruOpen" => session.PassThruOpen(@params),
      "PassThruClose" => session.PassThruClose(@params),
      "PassThruConnect" => session.PassThruConnect(@params),
      "PassThruDisconnect" => session.PassThruDisconnect(@params),
      "PassThruStartMsgFilter" => session.PassThruStartMsgFilter(@params),
      "PassThruIoctl" => session.PassThruIoctl(@params),
      "PassThruWriteMsgs" => session.PassThruWriteMsgs(@params),
      "PassThruWriteRead" => session.PassThruWriteRead(@params),
      _ => throw new InvalidOperationException($"Méthode inconnue: {method}")
    };
  }

  private static async Task<string?> ReceiveText(WebSocket ws, byte[] buffer)
  {
    var sb = new StringBuilder();
    while (true)
    {
      var res = await ws.ReceiveAsync(buffer, CancellationToken.None);
      if (res.MessageType == WebSocketMessageType.Close) return null;
      sb.Append(Encoding.UTF8.GetString(buffer, 0, res.Count));
      if (res.EndOfMessage) break;
    }
    return sb.ToString();
  }

  private static Task SendJson(WebSocket ws, object payload)
  {
    var json = JsonSerializer.Serialize(payload, JsonOptions);
    var bytes = Encoding.UTF8.GetBytes(json);
    return ws.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, cancellationToken: CancellationToken.None);
  }

  private sealed class BridgeSession : IDisposable
  {
    private J2534Native? _j2534;

    public object PassThruOpen(JsonElement? p)
    {
      var name = GetString(p, "name") ?? "auto";
      var dllPath = ResolveDllPath(name);
      _j2534 = new J2534Native(dllPath);

      var deviceId = _j2534.PassThruOpen(string.Equals(name, "auto", StringComparison.OrdinalIgnoreCase) ? null : name);
      return new { DeviceID = deviceId };
    }

    public object PassThruClose(JsonElement? p)
    {
      Ensure();
      var deviceId = GetUInt(p, "DeviceID");
      _j2534!.PassThruClose(deviceId);
      return new { Ok = true };
    }

    public object PassThruConnect(JsonElement? p)
    {
      Ensure();
      var deviceId = GetUInt(p, "DeviceID");
      var protocolId = GetUInt(p, "ProtocolID");
      var flags = GetUInt(p, "Flags");
      var baud = GetUInt(p, "BaudRate");
      var channelId = _j2534!.PassThruConnect(deviceId, protocolId, flags, baud);
      return new { ChannelID = channelId };
    }

    public object PassThruDisconnect(JsonElement? p)
    {
      Ensure();
      var channelId = GetUInt(p, "ChannelID");
      _j2534!.PassThruDisconnect(channelId);
      return new { Ok = true };
    }

    public object PassThruStartMsgFilter(JsonElement? p)
    {
      Ensure();
      var channelId = GetUInt(p, "ChannelID");
      var filterType = GetUInt(p, "FilterType");

      var mask = p is { ValueKind: JsonValueKind.Object } && p.Value.TryGetProperty("Mask", out var m) ? m : default;
      var pattern = p is { ValueKind: JsonValueKind.Object } && p.Value.TryGetProperty("Pattern", out var pat) ? pat : default;

      var maskMsg = new J2534Native.PassThruMsg
      {
        ProtocolID = 6,
        DataSize = GetUInt(mask, "DataLength"),
        Data = J2534Native.ToMsgData(GetString(mask, "Data"))
      };
      var patternMsg = new J2534Native.PassThruMsg
      {
        ProtocolID = 6,
        DataSize = GetUInt(pattern, "DataLength"),
        Data = J2534Native.ToMsgData(GetString(pattern, "Data"))
      };

      var filterId = _j2534!.PassThruStartMsgFilter(channelId, filterType, maskMsg, patternMsg);
      return new { FilterID = filterId };
    }

    public object PassThruIoctl(JsonElement? p)
    {
      Ensure();
      var channelId = GetUInt(p, "ChannelID");
      var ioctlId = GetUInt(p, "IoctlID");
      _j2534!.PassThruIoctl(channelId, ioctlId);
      return new { Ok = true };
    }

    public object PassThruWriteMsgs(JsonElement? p)
    {
      Ensure();
      var channelId = GetUInt(p, "ChannelID");
      if (channelId == 0 && p is { ValueKind: JsonValueKind.Object } && p.Value.TryGetProperty("channelId", out var ch))
      {
        channelId = (uint)ch.GetInt32();
      }

      if (p is { ValueKind: JsonValueKind.Object } && p.Value.TryGetProperty("msg", out var msgObj))
      {
        var proto = GetUInt(msgObj, "ProtocolID");
        var arbId = GetUInt(msgObj, "ArbID");
        var dataHex = GetString(msgObj, "Data") ?? "";
        var payload = J2534Native.HexToBytes(dataHex);
        var data = new byte[4 + payload.Length];
        data[0] = (byte)((arbId >> 24) & 0xFF);
        data[1] = (byte)((arbId >> 16) & 0xFF);
        data[2] = (byte)((arbId >> 8) & 0xFF);
        data[3] = (byte)(arbId & 0xFF);
        Buffer.BlockCopy(payload, 0, data, 4, payload.Length);

        _j2534!.PassThruWriteMsgs(channelId, new J2534Native.PassThruMsg
        {
          ProtocolID = proto,
          TxFlags = 0,
          DataSize = (uint)data.Length,
          Data = J2534Native.ToMsgData(data)
        }, timeoutMs: 2000);
      }
      else if (p is { ValueKind: JsonValueKind.Object } && p.Value.TryGetProperty("TxMessages", out var txMessages) && txMessages.ValueKind == JsonValueKind.Array)
      {
        foreach (var m in txMessages.EnumerateArray())
        {
          var proto = GetUInt(m, "ProtocolID");
          var flags = GetUInt(m, "TxFlags");
          var dataHex = GetString(m, "Data") ?? "";
          var data = J2534Native.HexToBytes(dataHex);
          var dataLen = GetUInt(m, "DataLength");
          if (dataLen > 0 && dataLen < data.Length)
          {
            Array.Resize(ref data, (int)dataLen);
          }
          _j2534!.PassThruWriteMsgs(channelId, new J2534Native.PassThruMsg
          {
            ProtocolID = proto,
            TxFlags = flags,
            DataSize = (uint)data.Length,
            Data = J2534Native.ToMsgData(data)
          }, timeoutMs: 2000);
        }
      }

      return new { Ok = true };
    }

    public object PassThruWriteRead(JsonElement? p)
    {
      Ensure();
      var channelId = GetUInt(p, "ChannelID");
      var timeout = GetUInt(p, "Timeout");
      var rxAddress = GetUInt(p, "RxAddress");

      if (p is { ValueKind: JsonValueKind.Object } && p.Value.TryGetProperty("TxMessages", out var txMessages) && txMessages.ValueKind == JsonValueKind.Array)
      {
        foreach (var m in txMessages.EnumerateArray())
        {
          var proto = GetUInt(m, "ProtocolID");
          var flags = GetUInt(m, "TxFlags");
          var dataHex = GetString(m, "Data") ?? "";
          var data = J2534Native.HexToBytes(dataHex);
          var dataLen = GetUInt(m, "DataLength");
          if (dataLen > 0 && dataLen < data.Length)
          {
            Array.Resize(ref data, (int)dataLen);
          }
          _j2534!.PassThruWriteMsgs(channelId, new J2534Native.PassThruMsg
          {
            ProtocolID = proto,
            TxFlags = flags,
            DataSize = (uint)data.Length,
            Data = J2534Native.ToMsgData(data)
          }, timeoutMs: 2000);
        }
      }

      var endAt = DateTime.UtcNow.AddMilliseconds(timeout == 0 ? 3000 : timeout);
      while (DateTime.UtcNow < endAt)
      {
        var msgs = _j2534!.PassThruReadMsgs(channelId, maxMsgs: 10, timeoutMs: 200);
        foreach (var msg in msgs)
        {
          if (msg.DataSize < 4) continue;
          var arb = (uint)(msg.Data[0] << 24 | msg.Data[1] << 16 | msg.Data[2] << 8 | msg.Data[3]);
          if (arb != rxAddress) continue;
          var hex = J2534Native.BytesToHex(msg.Data, (int)msg.DataSize);
          return new { Messages = new[] { new { Data = hex, DataLength = msg.DataSize } } };
        }
      }

      return new { Messages = Array.Empty<object>() };
    }

    public void Dispose()
    {
      _j2534?.Dispose();
      _j2534 = null;
    }

    private void Ensure()
    {
      if (_j2534 is null) throw new InvalidOperationException("J2534 non initialisé (PassThruOpen requis)");
    }

    private static string ResolveDllPath(string name)
    {
      if (!string.Equals(name, "auto", StringComparison.OrdinalIgnoreCase))
      {
        return name;
      }

      var regPaths = new[]
      {
        @"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\PassThruSupport.04.04",
        @"HKEY_LOCAL_MACHINE\SOFTWARE\PassThruSupport.04.04"
      };

      foreach (var root in regPaths)
      {
        try
        {
          using var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, root.Contains("WOW6432Node") ? RegistryView.Registry32 : RegistryView.Registry64);
          using var key = baseKey.OpenSubKey(root.Contains("WOW6432Node") ? @"SOFTWARE\PassThruSupport.04.04" : @"SOFTWARE\PassThruSupport.04.04");
          if (key is null) continue;

          foreach (var subName in key.GetSubKeyNames())
          {
            using var sub = key.OpenSubKey(subName);
            var lib = sub?.GetValue("FunctionLibrary") as string;
            if (!string.IsNullOrWhiteSpace(lib) && File.Exists(lib))
            {
              return lib;
            }
          }
        }
        catch { }
      }

      throw new FileNotFoundException("Aucune DLL J2534 enregistrée trouvée. Installez le driver GoDiag et vérifiez PassThruSupport.04.04 (WOW6432Node).");
    }

    private static string? GetString(JsonElement? obj, string prop)
    {
      if (obj is not { ValueKind: JsonValueKind.Object }) return null;
      return obj.Value.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    }

    private static string? GetString(JsonElement obj, string prop)
    {
      return obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String
        ? v.GetString()
        : null;
    }

    private static uint GetUInt(JsonElement? obj, string prop)
    {
      if (obj is not { ValueKind: JsonValueKind.Object }) return 0;
      if (!obj.Value.TryGetProperty(prop, out var v)) return 0;
      if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) && i >= 0) return (uint)i;
      if (v.ValueKind == JsonValueKind.String && uint.TryParse(v.GetString(), out var u)) return u;
      return 0;
    }

    private static uint GetUInt(JsonElement obj, string prop)
    {
      if (obj.ValueKind != JsonValueKind.Object) return 0;
      if (!obj.TryGetProperty(prop, out var v)) return 0;
      if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) && i >= 0) return (uint)i;
      if (v.ValueKind == JsonValueKind.String && uint.TryParse(v.GetString(), out var u)) return u;
      return 0;
    }
  }

  private sealed class J2534Native : IDisposable
  {
    public struct PassThruMsg
    {
      public uint ProtocolID;
      public uint RxStatus;
      public uint TxFlags;
      public uint Timestamp;
      public uint DataSize;
      public uint ExtraDataIndex;
      public byte[] Data;
    }

    [StructLayout(LayoutKind.Sequential)]
    private unsafe struct NativePassThruMsg
    {
      public uint ProtocolID;
      public uint RxStatus;
      public uint TxFlags;
      public uint Timestamp;
      public uint DataSize;
      public uint ExtraDataIndex;
      public fixed byte Data[4128];
    }

    private readonly nint _lib;
    private readonly string _dllPath;

    private readonly PassThruOpenDelegate _open;
    private readonly PassThruCloseDelegate _close;
    private readonly PassThruConnectDelegate _connect;
    private readonly PassThruDisconnectDelegate _disconnect;
    private readonly PassThruWriteMsgsDelegate _writeMsgs;
    private readonly PassThruReadMsgsDelegate _readMsgs;
    private readonly PassThruStartMsgFilterDelegate _startFilter;
    private readonly PassThruIoctlDelegate _ioctl;
    private readonly PassThruGetLastErrorDelegate? _getLastError;

    public J2534Native(string dllPath)
    {
      _dllPath = dllPath;
      _lib = NativeLibrary.Load(dllPath);
      _open = Get<PassThruOpenDelegate>("PassThruOpen");
      _close = Get<PassThruCloseDelegate>("PassThruClose");
      _connect = Get<PassThruConnectDelegate>("PassThruConnect");
      _disconnect = Get<PassThruDisconnectDelegate>("PassThruDisconnect");
      _writeMsgs = Get<PassThruWriteMsgsDelegate>("PassThruWriteMsgs");
      _readMsgs = Get<PassThruReadMsgsDelegate>("PassThruReadMsgs");
      _startFilter = Get<PassThruStartMsgFilterDelegate>("PassThruStartMsgFilter");
      _ioctl = Get<PassThruIoctlDelegate>("PassThruIoctl");
      _getLastError = TryGet<PassThruGetLastErrorDelegate>("PassThruGetLastError");
    }

    public uint PassThruOpen(string? name = null)
    {
      uint deviceId = 0;
      var suggested = name;
      if (string.IsNullOrWhiteSpace(suggested) && _dllPath.IndexOf("GODIAG", StringComparison.OrdinalIgnoreCase) >= 0)
      {
        suggested = "GODIAG";
      }

      nint pName = nint.Zero;
      try
      {
        if (!string.IsNullOrWhiteSpace(suggested))
        {
          pName = Marshal.StringToHGlobalAnsi(suggested);
        }
        var status = _open(pName, ref deviceId);
        EnsureNoError(status, "PassThruOpen");
      }
      finally
      {
        if (pName != nint.Zero) Marshal.FreeHGlobal(pName);
      }
      return deviceId;
    }

    public void PassThruClose(uint deviceId)
    {
      var status = _close(deviceId);
      EnsureNoError(status, "PassThruClose");
    }

    public uint PassThruConnect(uint deviceId, uint protocolId, uint flags, uint baudRate)
    {
      uint channelId = 0;
      var status = _connect(deviceId, protocolId, flags, baudRate, ref channelId);
      EnsureNoError(status, "PassThruConnect");
      return channelId;
    }

    public void PassThruDisconnect(uint channelId)
    {
      var status = _disconnect(channelId);
      EnsureNoError(status, "PassThruDisconnect");
    }

    public uint PassThruStartMsgFilter(uint channelId, uint filterType, PassThruMsg mask, PassThruMsg pattern)
    {
      uint filterId = 0;
      unsafe
      {
        var m = ToNative(mask);
        var p = ToNative(pattern);
        var status = _startFilter(channelId, filterType, ref m, ref p, nint.Zero, ref filterId);
        EnsureNoError(status, "PassThruStartMsgFilter");
      }
      return filterId;
    }

    public void PassThruIoctl(uint channelId, uint ioctlId)
    {
      var status = _ioctl(channelId, ioctlId, nint.Zero, nint.Zero);
      if (status == 0) return;
    }

    public void PassThruWriteMsgs(uint channelId, PassThruMsg msg, uint timeoutMs)
    {
      unsafe
      {
        var native = ToNative(msg);
        uint numMsgs = 1;
        var status = _writeMsgs(channelId, ref native, ref numMsgs, timeoutMs);
        EnsureNoError(status, "PassThruWriteMsgs");
      }
    }

    public List<PassThruMsg> PassThruReadMsgs(uint channelId, uint maxMsgs, uint timeoutMs)
    {
      var output = new List<PassThruMsg>();
      unsafe
      {
        var native = new NativePassThruMsg();
        uint numMsgs = 1;
        var status = _readMsgs(channelId, ref native, ref numMsgs, timeoutMs);
        if (status != 0) return output;
        if (numMsgs == 0) return output;
        output.Add(FromNative(native));
      }
      return output;
    }

    public void Dispose()
    {
      try
      {
        NativeLibrary.Free(_lib);
      }
      catch { }
    }

    public static byte[] HexToBytes(string hex)
    {
      var clean = new string(hex.Where(Uri.IsHexDigit).ToArray());
      if (clean.Length % 2 == 1) clean = "0" + clean;
      var bytes = new byte[clean.Length / 2];
      for (var i = 0; i < bytes.Length; i++)
      {
        bytes[i] = Convert.ToByte(clean.Substring(i * 2, 2), 16);
      }
      return bytes;
    }

    public static string BytesToHex(byte[] bytes, int len)
    {
      var sb = new StringBuilder(len * 2);
      for (var i = 0; i < len && i < bytes.Length; i++)
      {
        sb.Append(bytes[i].ToString("X2"));
      }
      return sb.ToString();
    }

    public static byte[] ToMsgData(string? hexOrBytes)
    {
      return HexToBytes(hexOrBytes ?? "");
    }

    public static byte[] ToMsgData(byte[] data)
    {
      return data;
    }

    private static unsafe NativePassThruMsg ToNative(PassThruMsg managed)
    {
      var native = new NativePassThruMsg
      {
        ProtocolID = managed.ProtocolID,
        RxStatus = managed.RxStatus,
        TxFlags = managed.TxFlags,
        Timestamp = managed.Timestamp,
        DataSize = managed.DataSize,
        ExtraDataIndex = managed.ExtraDataIndex
      };
      var src = managed.Data ?? Array.Empty<byte>();
      var n = (int)Math.Min((uint)src.Length, managed.DataSize);
      for (var i = 0; i < n && i < 4128; i++)
      {
        native.Data[i] = src[i];
      }
      return native;
    }

    private static unsafe PassThruMsg FromNative(NativePassThruMsg native)
    {
      var data = new byte[4128];
      var n = (int)Math.Min(native.DataSize, 4128u);
      for (var i = 0; i < n; i++)
      {
        data[i] = native.Data[i];
      }
      return new PassThruMsg
      {
        ProtocolID = native.ProtocolID,
        RxStatus = native.RxStatus,
        TxFlags = native.TxFlags,
        Timestamp = native.Timestamp,
        DataSize = native.DataSize,
        ExtraDataIndex = native.ExtraDataIndex,
        Data = data
      };
    }

    private T Get<T>(string export) where T : Delegate
    {
      var ptr = NativeLibrary.GetExport(_lib, export);
      return Marshal.GetDelegateForFunctionPointer<T>(ptr);
    }

    private T? TryGet<T>(string export) where T : Delegate
    {
      try
      {
        var ptr = NativeLibrary.GetExport(_lib, export);
        return Marshal.GetDelegateForFunctionPointer<T>(ptr);
      }
      catch
      {
        return null;
      }
    }

    private void EnsureNoError(int status, string op)
    {
      if (status == 0) return;
      var last = TryGetLastError();
      if (!string.IsNullOrWhiteSpace(last))
      {
        throw new InvalidOperationException($"{op} a échoué (code {status}) - {last}");
      }
      throw new InvalidOperationException($"{op} a échoué (code {status})");
    }

    private string? TryGetLastError()
    {
      if (_getLastError is null) return null;
      var buf = new string('\0', 256);
      var sb = new StringBuilder(256);
      try
      {
        _getLastError(sb);
        var s = sb.ToString().Trim();
        return string.IsNullOrWhiteSpace(s) ? null : s;
      }
      catch
      {
        return null;
      }
    }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int PassThruOpenDelegate(nint pName, ref uint pDeviceId);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int PassThruCloseDelegate(uint deviceId);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int PassThruConnectDelegate(uint deviceId, uint protocolId, uint flags, uint baudRate, ref uint pChannelId);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int PassThruDisconnectDelegate(uint channelId);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private unsafe delegate int PassThruWriteMsgsDelegate(uint channelId, ref NativePassThruMsg pMsg, ref uint pNumMsgs, uint timeout);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private unsafe delegate int PassThruReadMsgsDelegate(uint channelId, ref NativePassThruMsg pMsg, ref uint pNumMsgs, uint timeout);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private unsafe delegate int PassThruStartMsgFilterDelegate(uint channelId, uint filterType, ref NativePassThruMsg maskMsg, ref NativePassThruMsg patternMsg, nint flowControlMsg, ref uint pFilterId);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int PassThruIoctlDelegate(uint channelId, uint ioctlId, nint pInput, nint pOutput);

    [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    private delegate int PassThruGetLastErrorDelegate(StringBuilder pErrorDescription);
  }

  private sealed class BridgeRequest
  {
    public int? Id { get; set; }
    public string? Method { get; set; }
    public JsonElement? Params { get; set; }
  }

  private sealed class BridgeResponse
  {
    public int Id { get; set; }
    public object? Result { get; set; }
    public string? Error { get; set; }
  }
}
