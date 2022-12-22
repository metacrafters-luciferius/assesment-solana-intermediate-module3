import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { AirdropProgram } from "../target/types/airdrop_program";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"

describe("airdrop-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.AirdropProgram as Program<AirdropProgram>;

  // derive PDA of the token mint and mint authority using our seeds 
  let tokenMint = PublicKey.findProgramAddressSync([Buffer.from("token-mint")], program.programId)
  const mintAuthority = PublicKey.findProgramAddressSync([Buffer.from("mint-authority")], program.programId)
  console.log("Token mint pda: ", tokenMint[0].toBase58())
	console.log("Mint auth pda: ", mintAuthority[0].toBase58())

  it("Create Mint", async () => {
    const tx = await program.methods.initializeMint(10)
    .accounts({
      tokenMint: tokenMint[0],
      mintAuthority: mintAuthority[0],
      payer: provider.wallet.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([])
    .rpc()
    console.log("Initialize mint tx:", tx);
  })

  it("Airdrop tokens", async () => {
    let userTokenAccount = await Keypair.generate()
    const tx = await program.methods.airdrop(new anchor.BN(12))
    .accounts({
      tokenMint: tokenMint[0],
      mintAuthority: mintAuthority[0],
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([userTokenAccount])
    .rpc()
    console.log("Airdrop tx:", tx)
  })

  it("Airdropping more tokens", async () => {
    let userTokenAccount = await Keypair.generate()
    const tx = await program.methods.airdrop(new anchor.BN(25))
    .accounts({
      tokenMint: tokenMint[0],
      mintAuthority: mintAuthority[0],
      user: provider.wallet.publicKey,
      userTokenAccount: userTokenAccount.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([userTokenAccount])
    .rpc()
    console.log("Airdrop tx:", tx)
  })
})
